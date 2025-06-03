// src/app/localize/localize.page.ts

import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonModal, Platform } from '@ionic/angular';

import * as L from 'leaflet';
// import 'leaflet-rotatedmarker';
import { WifilocService, LocalizationResult } from '../services/wifiloc.service';
// import { DeviceOrientation, DeviceOrientationCompassHeading } from '@awesome-cordova-plugins/device-orientation/ngx';

@Component({
  selector: 'app-localize',
  templateUrl: './localize.page.html',
  styleUrls: ['./localize.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LocalizePage implements OnInit, AfterViewInit {
  @ViewChild('coordsModal', { static: true }) coordsModal!: IonModal;

  //–– Modal fields
  public targetX: number | null = null;
  public targetY: number | null = null;

  //–– Leaflet
  private map!: L.Map;
  private currentLayer!: L.LayerGroup;   // holds “current” (red) marker
  private targetLayer!: L.LayerGroup;    // holds “target” (green) marker
  private routeLine!: L.Polyline;        // still holds the blue route

  private compassMarker!: L.Marker;        // ← the rotating arrow
  private headingSubscription: any;
  // ── Calibration constants ───────────────────────────────────────
  // At 200 DPI you found (x0=1760 px, y0=4222 px) from the top‐left.
  // Since the PNG is 600 DPI, scale each by 3:
  private readonly x0_px = 872;   // left‐bottom pixel (x0)
  private readonly y0_px = 2097   // left‐bottom pixel (y0)
  private readonly y_end_px = 176;    // top‐end pixel (y_end)
  private readonly x1 = 1510;
  private readonly y1 = 2017;
  private readonly x2 = 1628;
  private readonly y2 = 2016;
  private readonly pixPerM = Math.hypot(this.x2 - this.x1, this.y2 - this.y1) / 2.95;
  // (you can also hardcode the final pixPerM value from Python, e.g. 100 px/m etc.)

  // These will be set once the image loads:
  private imageWidth = 1;
  private imageHeight = 1;
  //–– Store current and target latlngs for routing
  private currentLatlng: L.LatLng | null = null;
  private targetLatlng: L.LatLng | null = null;
  constructor(
    private wifiService: WifilocService,
    private zone: NgZone,
    private plt: Platform,
    // private deviceOrientation: DeviceOrientation
  ) { }

  ngOnInit() {
    // no-op
  }


  ngAfterViewInit() {
    // 1) Preload the 600 dpi floor-plan PNG
    const img = new Image();
    img.src = 'assets/U1F_floorplan_with_2x2m_grid_600dpi.png';
    img.onload = () => {
      // only here is img.naturalWidth/naturalHeight available
      this.imageWidth = img.naturalWidth;
      this.imageHeight = img.naturalHeight;

      // 2) Create the Leaflet map in CRS.Simple
      this.map = L.map('map', {
        crs: L.CRS.Simple,
        zoom: 2,
        zoomSnap: 0.5,
        minZoom: -2,
        maxZoom: 4,
        zoomControl: true,
        attributionControl: false
      });

      // 3) Compute “bottom-left” & “top-right” in Leaflet coordinates at zoom=0
      const sw = this.map.unproject([0, this.imageHeight], 0);
      const ne = this.map.unproject([this.imageWidth, 0], 0);
      const imageBounds = new L.LatLngBounds(sw, ne);

      // 4) Place the image overlay and clamp the map’s bounds
      L.imageOverlay(
        'assets/U1F_floorplan_with_2x2m_grid_600dpi.png',
        imageBounds
      ).addTo(this.map);
      this.targetLayer = L.layerGroup().addTo(this.map);
      this.currentLayer = L.layerGroup().addTo(this.map);
      this.routeLine = L.polyline([], {
        color: 'blue',
        weight: 3,
        opacity: 0.8,
        smoothFactor: 1
      }).addTo(this.map);
      this.map.setMaxBounds(imageBounds);
      this.map.fitBounds(imageBounds, { maxZoom: 2, animate: false });

      // 5) Create a layer group for your “current position” red dot
      

      //   // 6) Create the compass‐arrow marker *after* the map is ready
      //   //    Now that this.map exists, `this.map.getCenter()` will return a valid LatLng.
      //   const centerPoint = this.map.getCenter();
      //   const arrowIcon = L.icon({
      //     iconUrl:    'assets/compass-arrow.png',
      //     iconSize:   [32, 32],
      //     iconAnchor: [16, 16]
      //   });

      //   // Cast to `any` so TS doesn’t complain about rotationAngle/rotationOrigin
      //   this.compassMarker = (L.marker(centerPoint, {
      //     icon:            arrowIcon,
      //     rotationAngle:   0,             // initially pointing north
      //     rotationOrigin:  'center center'
      //   } as any)).addTo(this.map);

      //   // Whenever the user pans, keep the compass arrow centered
      //   this.map.on('move', () => {
      //     const center = this.map.getCenter(); // now this.map is defined
      //     this.compassMarker.setLatLng(center);
      //   });

      //   // 7) Subscribe to device heading changes
      //   this.headingSubscription = this.deviceOrientation
      //     .watchHeading({ frequency: 250 })
      //     .subscribe((data: DeviceOrientationCompassHeading) => {
      //       const heading = data.magneticHeading; // 0° = North
      //       this.zone.run(() => {
      //         // Rotate at runtime; TS is okay because we used `as any`
      //         (this.compassMarker as any).setRotationAngle(heading);
      //       });
      //     });
      // };
    }
  }


  /**
   * Called when the user clicks the “Locate” button.
   * This will ask the service for (room, x, y) in meters,
   * convert it to pixel coordinates, and draw a red dot.
   */
  async locate() {
    try {
      // STEP 1: Ask your service for (room, x, y) in METERS
      const res: LocalizationResult = await this.wifiService.scanAndLocalize();
      console.log('Meters =', res.x, ',', res.y);

      // STEP 2: Convert (meter → pixel) at 600 dpi:
      //   pixelX = x0_px + (res.x × pixPerM)
      //   pixelY = y0_px − (res.y × pixPerM)
      const pxNatX = this.x0_px + res.x * this.pixPerM;
      const pxNatY = this.y0_px - res.y * this.pixPerM;

      console.log(`→ pixel coordinates = (${pxNatX.toFixed(1)}, ${pxNatY.toFixed(1)})`);

      // STEP 3: “Unproject” pixel coords at zoom=0 → Leaflet latlng
      const latlng = this.map.unproject([pxNatX, pxNatY], 0);

      this.currentLatlng = latlng;

      console.log('Locate(): currentLatlng =', this.currentLatlng);
      if (this.targetLatlng) {
        console.log('Calling drawRoute() because targetLatlng is set');
        this.drawRoute();
      } else {
        console.log('Not drawing route because targetLatlng is still null');
      }

      // STEP 4: Draw a red dot there
      this.currentLayer.clearLayers();
      const dotIcon = L.divIcon({
        className: 'leaflet-marker-dot',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      L.marker(latlng, { icon: dotIcon }).addTo(this.currentLayer);

      // STEP 5: Pan so that your dot is centered (keep current zoom)
      const z = this.map.getZoom();
      this.map.flyTo(latlng, z, { animate: true, duration: 0.8 });
    }
    catch (err: any) {
      console.error('Localization error:', err);
      alert('Localization failed: ' + (err.message || err));
    }
  }

  sanityCheck() {
    const latlng00 = this.map.unproject([this.x0_px, this.y0_px], 0);
    L.marker(latlng00, {
      icon: L.divIcon({
        className: 'leaflet-marker-dot',
        iconSize: [8, 8], iconAnchor: [4, 4]
      })
    })
      .addTo(this.map)
      .bindPopup('This is (0,0) in meters');

    const px2m = this.x0_px + 2 * this.pixPerM;
    const test2mx = this.map.unproject([px2m, this.y0_px], 0);
    L.marker(test2mx, {
      icon: L.divIcon({
        className: 'leaflet-marker-dot1',
        iconSize: [8, 8], iconAnchor: [4, 4]
      })
    })
      .addTo(this.map)
      .bindPopup('This is (0,2) in meters');



    const pxY2m = this.y0_px - 2 * this.pixPerM;
    const test2my = this.map.unproject([this.x0_px, pxY2m], 0);
    L.marker(test2my, {
      icon: L.divIcon({
        className: 'leaflet-marker-dot2',
        iconSize: [8, 8], iconAnchor: [4, 4]
      })
    })
      .addTo(this.map).bindPopup('2 m up');
  }

  async goToCoords() {
    if (this.targetX === null || this.targetY === null) {
      return;
    }

    // Convert (targetX, targetY) meters → native pixels
    const pxX = this.x0_px + this.targetX * this.pixPerM;
    const pxY = this.y0_px - this.targetY * this.pixPerM;
    console.log(`→ Target pixel: (${pxX.toFixed(1)}, ${pxY.toFixed(1)})`);

    // Unproject → Leaflet LatLng
    const latlng = this.map.unproject([pxX, pxY], 0);
    // Save targetLatlng
    this.targetLatlng = latlng;
    console.log('GoToCoords: targetLatlng =', this.targetLatlng);

    // Draw a green marker for “target”
    // (you could also use a different icon)
    this.targetLayer.clearLayers();
    L.marker(latlng, {
      icon: L.divIcon({
        className: 'leaflet-marker-dot-green',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
    }).addTo(this.targetLayer);

    // If we already have currentLatlng, draw route now:
    if (this.currentLatlng) {
      console.log('Calling drawRoute() because currentLatlng is set');
      this.drawRoute();
    } else {
      console.log('Not drawing route because currentLatlng is still null');
    }

    // Optionally pan half‐way toward the target so user sees it
    const currentZoom = this.map.getZoom();
    this.map.flyTo(latlng, currentZoom, { animate: true, duration: 0.8 });

    // Reset modal form fields
    this.targetX = null;
    this.targetY = null;
  }

  /**
   * Draws a straight polyline between currentLatlng and targetLatlng.
   * Clears any previous route first.
   */
  private drawRoute() {
    if (!this.currentLatlng || !this.targetLatlng) {
      return;
    }
    // Clear old polyline
    this.routeLine.setLatLngs([]);

    // Set new polyline coordinates
    this.routeLine.setLatLngs([this.currentLatlng, this.targetLatlng]);
  }
  //   ngOnDestroy() {
  //   if (this.headingSubscription) {
  //     this.headingSubscription.unsubscribe();
  //   }
  // }
}
