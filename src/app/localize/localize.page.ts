// src/app/localize/localize.page.ts

import {
  Component,
  OnInit,
  AfterViewInit,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, Platform } from '@ionic/angular';

import * as L from 'leaflet';
import { WifilocService, LocalizationResult } from '../services/wifiloc.service';

@Component({
  selector: 'app-localize',
  templateUrl: './localize.page.html',
  styleUrls: ['./localize.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LocalizePage implements OnInit, AfterViewInit {
  private map!: L.Map;
  private markerLayer!: L.LayerGroup;

  // ── Calibration constants ───────────────────────────────────────
  // At 200 DPI you found (x0=1760 px, y0=4222 px) from the top‐left.
  // Since the PNG is 600 DPI, scale each by 3:
   private readonly x0_px    = 1044;   // left‐bottom pixel (x0)
   private readonly y0_px    = 2506;   // left‐bottom pixel (x0)
  private readonly y_end_px = 176;    // top‐end pixel (y_end)
  private readonly pixPerM  = Math.hypot(1954 - 1811, 2380 - 2380) / 2.9;  
  // (you can also hardcode the final pixPerM value from Python, e.g. 100 px/m etc.)

  // These will be set once the image loads:
  private imageWidth = 1;
  private imageHeight = 1;

  constructor(
    private wifiService: WifilocService,
    private zone: NgZone,
    private plt: Platform
  ) { }

  ngOnInit() {
    // no-op
  }

  ngAfterViewInit() {
    // Step 1: Preload the PNG so we know its actual “natural” dimensions:
    const img = new Image();
    img.src = 'assets/U1F_floorplan_with_2x2m_grid_600dpi.png';
    img.onload = () => {
      this.imageWidth = img.naturalWidth;
      this.imageHeight = img.naturalHeight;

      // Step 2: Initialize Leaflet in CRS.Simple (1px = 1 map‐unit at zoom 0)
      this.map = L.map('map', {
        crs: L.CRS.Simple,
        zoomSnap: 0.5,       // allow 0.5 zoom increments if you like
        minZoom: -5,
        maxZoom: 4,
        zoomControl: true,
        attributionControl: false
      });

      // Step 3: Compute the image bounds in “map coordinates” at zoom 0
      // “southWest” = bottom-left in pixel space → unproject([0, imageHeight], 0)
      // “northEast” = top-right in pixel space → unproject([imageWidth, 0], 0)
      const sw = this.map.unproject([0, this.imageHeight], 0);
      const ne = this.map.unproject([this.imageWidth, 0], 0);
      const imageBounds = new L.LatLngBounds(sw, ne);

      // Step 4: Place the overlay, fix map bounds, and set initial zoom to 1.5
      L.imageOverlay('assets/U1F_floorplan_with_grid.png', imageBounds).addTo(this.map);
      this.map.setMaxBounds(imageBounds);
      this.map.fitBounds(imageBounds, { maxZoom: 2, animate: false });

      // Step 5: Create a layer group for the red dot(s)
      this.markerLayer = L.layerGroup().addTo(this.map);
    };
  }

  /** Called by the “Locate Me” button in your template */
  async locate() {
    try {
      // STEP 1: Ask your service for (room, x, y) in meters
      const res: LocalizationResult = await this.wifiService.scanAndLocalize();
      console.log('Room:', res.room, 'Meters:', res.x, res.y);

      // STEP 2: Convert (meters → native 600 DPI pixels).
      //   At Y=0 m, pixel-from-top = y0_px.
      //   As y (meters) increases, we move up in the image (i.e. fewer px from top):
      const pxNatX = this.x0_px + res.x * this.pixPerM;
      const pxNatY = this.y0_px - res.y * this.pixPerM;

      // STEP 3: Unproject these native‐pixel coords at zoom=0 → a Leaflet latlng
      //   (CRS.Simple treats [px, py] as [x, y] measured from top-left):
      const latlng = this.map.unproject([pxNatX, pxNatY], 0);

      // STEP 4: Remove any old dot, then draw a new divIcon
      this.markerLayer.clearLayers();
      const dotIcon = L.divIcon({
        className: 'leaflet-marker-dot',
        iconSize:   [12, 12],
        iconAnchor: [6, 6]  // center of the 12×12 dot sits exactly at latlng
      });
      L.marker(latlng, { icon: dotIcon }).addTo(this.markerLayer);

      // STEP 5: Pan (not zoom) so that your dot stays in view, preserving current zoom
      const currentZoom = this.map.getZoom();
      this.map.flyTo(latlng, currentZoom, {
        animate: true,
        duration: 1.0
      });
    }
    catch (err: any) {
      console.error('Localization error:', err);
      alert('Localization failed: ' + (err.message || err));
    }
  }
}
