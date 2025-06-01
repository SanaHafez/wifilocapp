import { Component, OnInit, ViewChild, ElementRef,AfterViewInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { IonicModule }    from '@ionic/angular';
import { WifilocService } from '../services/wifiloc.service';
// Import Panzoom:
import panzoom from '@panzoom/panzoom';
@Component({
  selector: 'app-localize',
  templateUrl: './localize.page.html',
  styleUrls: ['./localize.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LocalizePage implements OnInit, AfterViewInit  {

  // position: any;
 @ViewChild('floorImg', { read: ElementRef })
  floorImgRef!: ElementRef<HTMLImageElement>;

  @ViewChild('mapWrapper', { read: ElementRef })
  mapWrapperRef!: ElementRef<HTMLElement>;

  @ViewChild('panContainer', { read: ElementRef })
  panContainerRef!: ElementRef<HTMLElement>;

  position: { room: string; x: number; y: number } | null = null;

// Pixel → meter calibration (copied from your Python code)
  private readonly x0_px    = 1760;   // left‐bottom pixel (x0)
  private readonly y_end_px = 397;    // top‐end pixel (y_end)
  private readonly pixPerM  = Math.hypot(3276 - 3042, 4161 - 4166) / 2.9;  
  // (you can also hardcode the final pixPerM value from Python, e.g. 100 px/m etc.)
 // Store Panzoom instance:
  private panzoomInstance: any;
  // Once <img> loads, we grab its naturalWidth/naturalHeight:
  private naturalWidth  = 1;
  private naturalHeight = 1;

  // Computed marker position in CSS pixel space:
  markerPx: { x: number; y: number } | null = null;
  // CSS transform string (e.g. "translate(-400px, -200px) scale(2)")
  transformStyle = '';
    constructor(private wifiService: WifilocService) {}

  ngOnInit() {
  }
ngAfterViewInit() {
    // Once Angular has rendered the panContainer, initialize Panzoom on it:
    const panEl = this.panContainerRef.nativeElement;

    this.panzoomInstance = panzoom(panEl, {
      maxZoom: 4,      // allow up to 400% zoom
      minZoom: 1,      // do not zoom smaller than 100%
      bounds: true,    // do not allow panning outside of content
      boundsPadding: 0.1,
      // Enable pinch to zoom & double‐click to zoom by default
      // (you can adjust these or disable doubleClickZoom if desired)
      zoomDoubleClickSpeed: 1.0
    });
  }
  onImageLoad() {
    const img = this.floorImgRef.nativeElement;
    this.naturalWidth  = img.naturalWidth;
    this.naturalHeight = img.naturalHeight;

    // We could optionally “center” the image when it first loads, e.g.
    // centerHorizontally + centerVertically. For now, let it sit at (0,0).
  }
// async locate() {
//   try {
//     const res = await this.wifiService.scanAndLocalize();
//     console.log('Room:', res.room, 'Coordinates:', res.x, res.y);
//     this.position = res;
//   } catch(err) {
//     console.error(err);
//   }
// }

async locate() {
    try {
      const res = await this.wifiService.scanAndLocalize();
      // res: { room: string, x: number, y: number } in meters
      console.log('Room:', res.room, 'Meters:', res.x, res.y);
      this.position = res;

      // Now convert (res.x, res.y) [meters] → pixel on the natural image
      // 1) Find pixel coordinates on the *natural* image:
      const pxNatX = this.x0_px + res.x * this.pixPerM;
      // When y=0, we want pixelY = y_end_px; as y>0, we move downward, so subtract:
      const pxNatY = this.y_end_px + ( - res.y * this.pixPerM );
      // Explanation:
      //   - When y=0m, pixel Y = y_end_px
      //   - When y>0m, pixel Y moves downward, so we subtract res.y*pixPerM
      //   - In your Python code you used: ym = (y0 - yi)/pix_per_m.  Rearranged here.

      // 2) Now account for any CSS scaling!  If the <img> is rendered smaller than "naturalWidth",
      //    we need a scale factor.  Let:
      const imgEl = this.floorImgRef.nativeElement;
      const displayedWidth  = imgEl.clientWidth;
      const displayedHeight = imgEl.clientHeight;
      // The scale factor from natural→displayed:
      const scaleX = displayedWidth  / this.naturalWidth;
      const scaleY = displayedHeight / this.naturalHeight;
      // (They should be the same if you used `max-width:100%` / `height:auto`)

      // 4) Convert to CSS px in current zoom/viewport:
      //    Note: If the user has already zoomed/panned manually, we must account for that.
      //    Panzoom provides `getScale()` and `getPan()` APIs:
      const currentScale = this.panzoomInstance.getScale();
      const panState = this.panzoomInstance.getPan(); 
      // panState = { x: dx, y: dy } in CSS px, i.e. current translate

      const finalX = pxNatX * scaleX;
      const finalY = pxNatY * scaleY;
      this.markerPx = { x: finalX, y: finalY };

      // 5) Now animate pan/zoom so the marker ends up near center:
      //
      //    Let’s choose a “targetZoom”. You can keep the existing scale if you want:
      const targetZoom = 2; 

      // On-screen (wrapper) dimensions:
      const wrapperEl = this.mapWrapperRef.nativeElement;
      const wrapW = wrapperEl.clientWidth;
      const wrapH = wrapperEl.clientHeight;

      // After we scale *again* by zoomFactor, the marker’s on-screen px becomes finalX * zoomFactor.
      // We want that pixel to land at (wrapW/2, wrapH/2). So:
      //
      //   translateX = (wrapW/2)  - ( finalX * zoomFactor )
      //   translateY = (wrapH/2)  - ( finalY * zoomFactor )
      //
      const shiftX = wrapW / 2 - finalX * targetZoom;
      const shiftY = wrapH / 2 - finalY * targetZoom;

     //    In Panzoom, you can do:
      //      panzoomInstance.zoomAbs(pointX, pointY, scale, { animate: true })
      //    and then:
      //      panzoomInstance.moveTo( shiftX, shiftY, { animate: true })
      //
      //    But it’s simpler to do both in one: use `panzoomInstance.smoothZoom()`:
      this.panzoomInstance.smoothZoom(
        wrapW / 2,   // zoom about the center of the wrapper
        wrapH / 2,   // 
        targetZoom, 
        { 
          animate: true, 
          // After zoom is applied, we then pan so the marker is centered:
          onZoom: () => {
            // Once zoom finishes, we move:
            this.panzoomInstance.smoothMoveTo(shiftX, shiftY, { animate: true });
          }
        }
      );
    }
    catch (err) {
      console.error(err);
      this.position = null;
      this.markerPx = null;
    }
  }
}


