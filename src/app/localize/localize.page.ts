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
// Update the import path if the file is in a different location, for example:
// …other imports…
import { roomCenters } from '../data/room-centers';    // ← the lookup table

// Or, if the file does not exist, create 'src/utils/occupancy.ts' and export 'buildOccupancyGrid' from it.
import { astarGrid } from '../utils/astar';
import { dijkstraGrid } from '../utils/dijkstraGrid';

import { buildOccupancyGrid } from '../utils/occupancy';
import { DeviceOrientation, DeviceOrientationCompassHeading } from '@awesome-cordova-plugins/device-orientation/ngx';

@Component({
  selector: 'app-localize',
  templateUrl: './localize.page.html',
  styleUrls: ['./localize.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LocalizePage implements OnInit, AfterViewInit {
  @ViewChild('coordsModal', { static: true }) coordsModal!: IonModal;
  /**— for the "Select a Room" dropdown: —**/
  public roomIds: string[] = [];         // e.g. ["U-1F-32", "U-1F-29", …]
  public selectedRoom: string | null = null;

  //–– Modal fields
  public targetX: number | null = null;
  public targetY: number | null = null;

  //–– Leaflet
  private map!: L.Map;
  private currentLayer!: L.LayerGroup;   // holds “current” (red) marker
  private targetLayer!: L.LayerGroup;    // holds “target” (green) marker
  private routeLayer!: L.Polyline;        // still holds the blue route

  private compassMarker!: L.Marker;        // ← the rotating arrow
  private headingSubscription: any;
  // ── Calibration constants ───────────────────────────────────────
  // At 200 DPI you found (x0=1760 px, y0=4222 px) from the top‐left.
  // Since the PNG is 600 DPI, scale each by 3:
  private readonly x0_px = 872;   // left‐bottom pixel (x0)
  private readonly y0_px = 2097   // left‐bottom pixel (y0)
  private readonly xEnd_px = 3735;    // top‐end pixel (y_end)
  private readonly yEnd_px = 167;    // top‐end pixel (y_end)
  private readonly x1 = 1510;
  private readonly y1 = 2016;
  private readonly x2 = 1628;
  private readonly y2 = 2016;
  private readonly pixPerM = Math.hypot(this.x2 - this.x1, this.y2 - this.y1) / 2.95;
  // (you can also hardcode the final pixPerM value from Python, e.g. 100 px/m etc.)
  private gridStep = 0.5; // 1 m resolution

  // The occupancy grid (once built):
  private occupancyGrid: boolean[][] = [];

  // Keep track of current/target *grid* indices:
  private currentRC: [number, number] | null = null;
  private targetRC: [number, number] | null = null;
  // These will be set once the image loads:
  private imageWidth = 1;
  private imageHeight = 1;
  //–– Store current and target latlngs for routing
  private currentLatlng: L.LatLng | null = null;
  private targetLatlng: L.LatLng | null = null;
  currentRoom!: string;
  currentX: number | undefined;
  currentY: number | undefined;
  isTracking = false;
  private trackingHandle: any;  // holds interval ID
  constructor(
    private wifiService: WifilocService,
    private zone: NgZone,
    private plt: Platform,
    private deviceOrientation: DeviceOrientation
  ) { }

  ngOnInit() {
    this.roomIds = Object.keys(roomCenters).sort();
  }


  ngAfterViewInit() {
    // 1) Preload the 600 dpi floor-plan PNG
    const img = new Image();
    img.src = 'assets/floormap/U1F_floorplan_with_2x2m_grid_600dpi2.png';
    img.onload = async () => {
      // only here is img.naturalWidth/naturalHeight available
      this.imageWidth = img.naturalWidth;
      this.imageHeight = img.naturalHeight;
      // 3) Build the occupancy grid once and for all:
      this.occupancyGrid = await buildOccupancyGrid(
        'assets/floormap/U1F_floorplan_with_2x2m_grid_600dpi8.png',
        this.x0_px,
        this.y0_px,
        this.xEnd_px,
        this.yEnd_px,
        this.pixPerM,
        this.gridStep
      );
      // 2) Create the Leaflet map in CRS.Simple
      this.map = L.map('map', {
        crs: L.CRS.Simple,
        zoom: 3,
        zoomSnap: 0.5,
        minZoom: -3,
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
        'assets/floormap/U1F_floorplan_with_2x2m_grid_600dpi2.png', imageBounds).addTo(this.map);
      this.map.setMaxBounds(imageBounds);
      this.map.fitBounds(imageBounds, { maxZoom: 3, animate: false });

      this.targetLayer = L.layerGroup().addTo(this.map);
      this.currentLayer = L.layerGroup().addTo(this.map);
      this.routeLayer = L.polyline([], {
        color: 'green', weight: 4,
        opacity: 0.8, smoothFactor: 1
      }).addTo(this.map);

      // ***NOW draw the occupancy grid overlay:***
      this.drawOccupancyOverlay();
      this.locate();
      // // 5) Create a layer group for your “current position” red dot

      // // 1) After your map has been initialized and the floor plan overlay has been added,
      // //    grab a reference to the “map pane” DOM element: grab the map pane DOM element
      // const mapPane = this.map.getPane('mapPane');
      // if (mapPane) {
      //   // 2) Make sure its transform origin is the exact center (so it pivots around the middle)
      //   mapPane.style.transformOrigin = '50% 50%';
      // } else {
      //   console.error('Leaflet map pane not found!');
      // }


      // // 7) Start listening to device heading → rotate map accordingly
      // this.headingSubscription = this.deviceOrientation
      //   .watchHeading({ frequency: 150 })
      //   .subscribe((data: DeviceOrientationCompassHeading) => {
      //     const heading = data.magneticHeading; // 0° = North

      //     // // a) Rotate the map container so “north” remains up
      //     // const mapContainer = this.map.getContainer();
      //     // mapContainer.style.transformOrigin = "50% 50%";
      //     // if (mapContainer) {
      //     //   mapContainer.style.transform = `rotate(${-heading}deg)`;
      //     // }
      //     // else { console.error("Map container not found!") }
      //     // // b) Counter‐rotate any markers (so they stay upright):

      //       (mapPane as HTMLElement).style.transform = `rotate(${-heading}deg)`;
      //     this.currentLayer.eachLayer((layer: any) => {
      //       if (layer.getElement) {
      //         const el = layer.getElement();
      //         el.style.transformOrigin = "center center";
      //         el.style.transform = `rotate(${heading}deg)`;
      //       }
      //     });
      //     this.targetLayer.eachLayer((layer: any) => {
      //       if (layer.getElement) {
      //         const el = layer.getElement();
      //         el.style.transformOrigin = "center center";
      //         el.style.transform = `rotate(${heading}deg)`;
      //       }
      //     });

      //     // c) If you later add a “compass arrow” marker, you can rotate it by +heading
      //     //    so that it always points north relative to the rotated floorplan.
      //   });

      // Optionally, you could also immediately call this.drawOccupancyOverlay() here
      // if you want to visualize all blocked cells as a faint red overlay.


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

  toggleTracking() {
    if (this.isTracking) {
      // stop
      clearInterval(this.trackingHandle);
      this.isTracking = false;
    } else {
      // start
      this.isTracking = true;
      this.locate(); // do one immediately
      this.trackingHandle = setInterval(() => {
        this.locate();
      }, 2000); // adjust the interval as you wish
    }
  }
  ngOnDestroy() {
    if (this.headingSubscription) {
      this.headingSubscription.unsubscribe();
    }
    if (this.trackingHandle) {
      clearInterval(this.trackingHandle);
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
      this.currentRoom = res.room;
      this.currentX = res.x;
      this.currentY = res.y;

      console.log(`→ pixel coordinates = (${pxNatX.toFixed(1)}, ${pxNatY.toFixed(1)})`);

      // STEP 3: “Unproject” pixel coords at zoom=0 → Leaflet latlng
      const latlng = this.map.unproject([pxNatX, pxNatY], 0);

      this.currentLatlng = latlng;
      // Compute which grid‐cell row/column corresponds to (res.x, res.y):
      const r = Math.round(res.y / this.gridStep);
      const c = Math.round(res.x / this.gridStep);
      this.currentRC = [r, c];
      console.log('Computed currentRC =', this.currentRC,
        'occupancy at that cell =', this.occupancyGrid[r][c]);
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
      // alert('Localization failed: ' + (err.message || err));
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

  async goToCoords(targetX?: number, targetY?: number) {
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
    this.targetLayer.clearLayers();
    // Compute the grid‐cell indices for the target (in meters):
    const rt = Math.round(this.targetY / this.gridStep);
    const ct = Math.round(this.targetX / this.gridStep);
    this.targetRC = [rt, ct];
    console.log('Computed targetRC =', this.targetRC,
      'occupancy at that cell =', this.occupancyGrid[rt][ct]);

    const greenIcon = L.divIcon({
      className: 'leaflet-marker-dot-green',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    L.marker(latlng, { icon: greenIcon }).addTo(this.targetLayer);

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
    if (!this.currentLatlng || !this.targetLatlng || !this.currentRC || !this.targetRC) {
      return;
    }

    // Run A* on the occupancyGrid; returns a list of [r,c] steps
    // const pathRC: Array<[number, number]> = astarGrid(
    //   this.occupancyGrid,
    //   this.currentRC,
    //   this.targetRC
    // );

    const pathRC: Array<[number, number]> = dijkstraGrid(
      this.occupancyGrid,
      this.currentRC!,
      this.targetRC!
    );
    // Clear old polyline
    // Clear old route
    // this.routeLayer.clearLayers();
    this.routeLayer.setLatLngs([]);
    if (pathRC.length === 0) {
      alert('⚠️ No path found to target.');
      return;
    }
    // Set new polyline coordinates
    // this.routeLayer.setLatLngs([this.currentLatlng, this.targetLatlng]);
    // Convert each [r,c] → Leaflet LatLng
    const latlngs: L.LatLngExpression[] = pathRC.map(([r, c]) => {
      const x_m = c * this.gridStep;
      const y_m = r * this.gridStep;
      const pxX = this.x0_px + x_m * this.pixPerM;
      const pxY = this.y0_px - y_m * this.pixPerM;
      return this.map.unproject([pxX, pxY], 0);
    });

    // Draw a blue polyline
    this.routeLayer.setLatLngs(latlngs);
    this.routeLayer.setStyle({
      color: '#8D11CE',
      weight: 3,
      opacity: 0.8,
    });
  }
  //   ngOnDestroy() {
  //   if (this.headingSubscription) {
  //     this.headingSubscription.unsubscribe();
  //   }
  // }
  /**
 * Overlay each occupancy cell as a tiny rectangle on the map.
 * Blocked cells (false) will be drawn in semi-transparent red;
 * free cells (true) can be left transparent (or drawn in light green).
 */
  private drawOccupancyOverlay(): void {
    // 1) Figure out how many rows/cols the grid has:
    const nRows = this.occupancyGrid.length;
    if (nRows === 0) { return; }
    const nCols = this.occupancyGrid[0].length;

    // 2) Precompute the pixel‐size (in px) of one grid cell (one “gridStep” in meters):
    //     gridStep is in meters → pixPerM is px per meter → cellWidthPx = pixPerM * gridStep
    const cellPx = this.pixPerM * this.gridStep;

    // 3) For each (r,c), if occupancyGrid[r][c] === false, draw a red rect.
    //    We need the four corners of that cell in pixel space:
    //
    //    – In “native pixels” (at 600 dpi) the center‐pixel of cell (r,c) is:
    //         pxCenterX = x0_px + (c * pixPerM * gridStep)
    //         pxCenterY = y0_px - (r * pixPerM * gridStep)
    //
    //    – But we want to draw the full cell, so half‐width = cellPx/2:
    //         left   = pxCenterX - (cellPx/2)
    //         right  = pxCenterX + (cellPx/2)
    //         top    = pxCenterY - (cellPx/2)
    //         bottom = pxCenterY + (cellPx/2)
    //
    //    Note: Leaflet’s “unproject([pxX,pxY],0)” expects [pxX, pxY] measured from the TOP‐LEFT of the image.
    //          In our convention, (0,0) at top‐left → pxY increases downward.  But our y0_px was computed
    //          so that (0 m) is at pixel y0_px, and as r increases, y0_px − (r*pixPerM) moves up, etc.
    //
    //    Once we have (left, top) and (right, bottom) in native‐pixel coords, do:
    //       let latlngTopLeft    = this.map.unproject([left,  top],    0);
    //       let latlngBottomRight = this.map.unproject([right, bottom], 0);
    //
    //    And L.rectangle([[latlngTopLeft], [latlngBottomRight]], { fillColor: 'red', fillOpacity: 0.3, weight: 0 }).addTo(this.map).

    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        // if this cell is blocked, draw a translucent red box:
        if (!this.occupancyGrid[r][c]) {
          // 3a) compute the center of the (r,c) cell in native‐pixel coordinates:
          const pxCenterX = this.x0_px + c * cellPx;
          const pxCenterY = this.y0_px - r * cellPx;

          // 3b) half the cell‐width in px:
          const halfCell = cellPx / 2;

          // 3c) compute the four corners in “pixel from top‐left” coordinate:
          const leftPx = pxCenterX - halfCell;
          const rightPx = pxCenterX + halfCell;
          const topPx = pxCenterY - halfCell;
          const bottomPx = pxCenterY + halfCell;

          // 3d) unproject those corners to Leaflet LatLng (zoom = 0):
          const topLeftLatLng = this.map.unproject([leftPx, topPx], 0);
          const bottomRightLatLng = this.map.unproject([rightPx, bottomPx], 0);

          // 3e) draw a rectangle.  (If you want free cells in green, add an `else` block.)
          const topLeft: L.LatLngTuple = [topLeftLatLng.lat, topLeftLatLng.lng];
          const bottomRight: L.LatLngTuple = [bottomRightLatLng.lat, bottomRightLatLng.lng];

          L.rectangle(
            [topLeft, bottomRight],
            {
              // color: '#FFA76C',
              weight: 0,
              fillColor: '#FFAF78',
              fillOpacity: 0.3
            }
          ).addTo(this.map);
        }
      }
    }
  }

  /**
 * Called when user picks a room from the <ion-select>.
 * We look up [x,y] = roomCenters[roomId], then call goToCoords(x, y).
 */
  public onRoomSelected(ev: any) {
    const roomId: string = ev.detail.value;
    if (!roomId) {
      return;
    }

    // Lookup the [x,y] meters for that room
    const center: [number, number] | undefined = roomCenters[roomId];
    if (!center) {
      alert(`No center coordinate found for room ${roomId}`);
      return;
    }
    const [xMeters, yMeters] = center;

    // Set the targetX/targetY and call your existing goToCoords logic
    this.targetX = xMeters;
    this.targetY = yMeters;
    // If your “Go To X/Y” logic is inside goToCoords(), call it directly:
    this.goToCoords();
  }


}
