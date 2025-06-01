// src/app/localize/localize.page.ts

import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, GestureController } from '@ionic/angular';
import panzoom from '@panzoom/panzoom';
import { WifilocService, LocalizationResult } from '../services/wifiloc.service';

@Component({
  selector: 'app-localize',
  templateUrl: './localize.page.html',
  styleUrls: ['./localize.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LocalizePage implements OnInit, AfterViewInit {
  @ViewChild('floorImg', { read: ElementRef }) floorImgRef!: ElementRef<HTMLImageElement>;
  @ViewChild('mapWrapper', { read: ElementRef }) mapWrapperRef!: ElementRef<HTMLElement>;
  @ViewChild('panContainer', { read: ElementRef }) panContainerRef!: ElementRef<HTMLElement>;
  @ViewChild('markerDot', { read: ElementRef }) markerDotRef!: ElementRef<HTMLElement>;

  // Holds the last returned (room, x, y)
  position: { room: string; x: number; y: number } | null = null;

  // Calibration constants (copy exactly from your Python):
  private readonly x0_px    = 1760;   // “0 meters” origin x in native‐pixel coords
  private readonly y_end_px = 397;    // “0 meters” origin y in native‐pixel coords (top of image)
  private readonly pixPerM  = Math.hypot(3276 - 3042, 4161 - 4166) / 2.9;
  // (In Python: pix_per_m = np.hypot(x2-x1, y2-y1)/2.9.)

  // We will store the image’s natural dimensions once it loads:
  private naturalWidth  = 1;
  private naturalHeight = 1;

  // Panzoom instance
  private panzoomInstance!: ReturnType<typeof panzoom>;

  // Current marker position in CSS px (for [(style.left.px)] and .top):
  markerPx: { x: number; y: number } | null = null;

  constructor(
    private wifiService: WifilocService,
    private zone: NgZone
  ) {}

  ngOnInit() {
    // nothing here
  }

  ngAfterViewInit() {
    // 1) Initialize Panzoom on the container – allow pinch‐to‐zoom + drag.
    const panEl = this.panContainerRef.nativeElement;
    this.panzoomInstance = panzoom(panEl, {
      maxZoom: 4,       // 400%
      minZoom: 1,       // 100%
      bounds: true,
      boundsPadding: 0.1,
      zoomDoubleClickSpeed: 1.0
    });

    // 2) Once the <img> fully loads, capture its naturalWidth/naturalHeight
    const imgEl = this.floorImgRef.nativeElement;
    imgEl.onload = () => {
      this.naturalWidth  = imgEl.naturalWidth;
      this.naturalHeight = imgEl.naturalHeight;
      // Optionally center‐initial view here, but we’ll leave it at top‐left.
    };
  }

  /**
   * Called when the user taps “Locate Me.” 
   *  – Scans Wi‐Fi, calls the cloud function, gets (room, x, y) in meters.
   *  – Converts (x,y) → pixel coords on the native image → CSS px → zoom/pan so dot is centered.
   */
  async locate() {
    try {
      const res: LocalizationResult = await this.wifiService.scanAndLocalize();
      console.log('Room:', res.room, 'Meters:', res.x, res.y);
      this.position = res;

      // 1) Convert (meters) → native pixels:
      const pxNatX = this.x0_px + res.x * this.pixPerM;
      // In Python you used bottom-left origin. Here y=0 => pixel Y = y_end_px.
      // As y increases (meters up), we go downward in the image coordinate,
      // so subtract res.y * pixPerM:
      const pxNatY = this.y_end_px - res.y * this.pixPerM;

      // 2) Convert native pixels → displayed CSS pixels:
      const imgEl = this.floorImgRef.nativeElement;
      const displayedW  = imgEl.clientWidth;
      const displayedH  = imgEl.clientHeight;
      // The scale factor image uses automatically (e.g. `max-width:100%`)
      const scaleX = displayedW  / this.naturalWidth;
      const scaleY = displayedH / this.naturalHeight;
      // (Normally scaleX===scaleY if you set `width:100%; height:auto`)

      const cssPxX = pxNatX * scaleX;
      const cssPxY = pxNatY * scaleY;
      this.markerPx = { x: cssPxX, y: cssPxY };

      // 3) Now choose a target zoom level (e.g. 2×):
      const targetZoom = 2;

      // 4) Compute the pan offset so that (cssPxX, cssPxY) ends up in the center of the wrapper
      const wrapperEl = this.mapWrapperRef.nativeElement;
      const wrapW = wrapperEl.clientWidth;
      const wrapH = wrapperEl.clientHeight;

      // After zooming, the on‐screen pixel of our marker = (cssPxX * targetZoom, cssPxY * targetZoom).
      // We want that to land at (wrapW/2, wrapH/2). Therefore:
      //   panX = (wrapW/2)  - (cssPxX * targetZoom)
      //   panY = (wrapH/2)  - (cssPxY * targetZoom)
      const shiftX = wrapW/2 - cssPxX * targetZoom;
      const shiftY = wrapH/2 - cssPxY * targetZoom;

      // 5) Animate zoom first, then pan:
      this.zone.run(() => {
        // Zoom around center of wrapper:
        this.panzoomInstance.zoom(targetZoom, { animate: true });
        // Then move to ensure marker is centered:
        // this.panzoomInstance.moveTo(shiftX, shiftY, { animate: true });
      });
    }
    catch (err:any) {
      console.error('Localization error:', err);
      this.position = null;
      this.markerPx = null;
      alert('Localization failed: ' + (err.message || err));
    }
  }
}
