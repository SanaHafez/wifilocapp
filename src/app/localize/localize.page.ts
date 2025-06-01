import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { IonicModule }    from '@ionic/angular';
import { WifilocService } from '../services/wifiloc.service';

@Component({
  selector: 'app-localize',
  templateUrl: './localize.page.html',
  styleUrls: ['./localize.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LocalizePage implements OnInit {

  // position: any;
  @ViewChild('floorImg', { read: ElementRef }) floorImgRef!: ElementRef<HTMLImageElement>;

  position: { room: string; x: number; y: number } | null = null;

// Pixel → meter calibration (copied from your Python code)
  private readonly x0_px    = 1760;   // left‐bottom pixel (x0)
  private readonly y_end_px = 397;    // top‐end pixel (y_end)
  private readonly pixPerM  = Math.hypot(3276 - 3042, 4161 - 4166) / 2.9;  
  // (you can also hardcode the final pixPerM value from Python, e.g. 100 px/m etc.)

  // Once <img> loads, we grab its naturalWidth/naturalHeight:
  private naturalWidth  = 1;
  private naturalHeight = 1;

  // Computed marker position in CSS pixel space:
  markerPx: { x: number; y: number } | null = null;
    constructor(private wifiService: WifilocService) {}


  ngOnInit() {
  }

  onImageLoad(ev: Event) {
    const imgEl = this.floorImgRef.nativeElement;
    this.naturalWidth  = imgEl.naturalWidth;
    this.naturalHeight = imgEl.naturalHeight;
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
      const scaleX = displayedWidth  / this.naturalWidth;
      const scaleY = displayedHeight / this.naturalHeight;
      // (They should be the same if you used `max-width:100%` / `height:auto`)

      // 3) Compute the final on‐screen pixel:
      const finalX = pxNatX * scaleX;
      const finalY = pxNatY * scaleY;

      // 4) Save into markerPx so the template can bind [ngStyle]
      this.markerPx = { x: finalX, y: finalY };
    } catch (err) {
      console.error(err);
      this.position = null;
      this.markerPx = null;
    }
  }
}


