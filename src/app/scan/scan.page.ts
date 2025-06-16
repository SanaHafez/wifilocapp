import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Platform, AlertController } from '@ionic/angular';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Insomnia } from '@awesome-cordova-plugins/insomnia/ngx';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory, Encoding, ReadFileResult } from '@capacitor/filesystem';
// import { IonHeader, IonItem, IonProgressBar } from "@ionic/angular/standalone";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';
import * as L from 'leaflet';

declare var WifiWizard2: any;

@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ScanPage implements OnInit, AfterViewInit {
  isDeviceReady = false;
  roomName: string = 'U-1F-';
  x: number = 1;
  y: number = 1;
  f: number = 1;
  scanCount: number = 0;
  totalScans: number = 50;
  isScanning: boolean = false;
  scanResultsList: any[] = [];
  scanDelay: number = 2000
  shouldStop: boolean = false;

  // collectedData: any[] = [];
  // your calibration constants
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

   pickerMap?: L.Map ;
   pickerMarker?: L.Marker;
   lastCenter?: L.LatLng;
   lastZoom?: number;

  public mapPickerOpen = false;


  constructor(private platform: Platform,
    private alertCtrl: AlertController,
    private file: File,
    private insomnia: Insomnia,
    private perms: AndroidPermissions
  ) { }
  async ngOnInit() {
    this.platform.ready().then(async () => {
      console.log('Platform ready');
      this.lastZoom = 1;
      this.isDeviceReady = true;
      // Request location permission via the Geolocation plugin
      const perm = await Geolocation.requestPermissions();
      // perm.location can be 'granted' | 'denied' | 'prompt'
      if (perm.location !== 'granted') {
        console.warn('Location permission denied');
        return;
      }

      try {
        await this.perms.requestPermissions([
          this.perms.PERMISSION.READ_EXTERNAL_STORAGE,
          this.perms.PERMISSION.WRITE_EXTERNAL_STORAGE
        ]);
      } catch {
        console.warn('Permission request failed—might be on Android 11+');
      }


      WifiWizard2.startScan();

    });


  }



  async scan() {
    this.shouldStop = false;
    if (!this.isDeviceReady) {
      console.log('Device not ready or running in browser');
      return;
    }

    if (typeof WifiWizard2 === 'undefined') {
      console.log('WifiWizard2 not available — are you running on a device?');
      return;
    }

    try {
      const connectedSSID = await WifiWizard2.getConnectedSSID();
      const scanResults = WifiWizard2.getScanResults()
      console.log('Connected SSID:', connectedSSID);
      console.log('Scan Results:', scanResults);


    } catch (error) {
      console.error('Error getting connected SSID:', error);
    }
  }

  stopScanning() {
    // signal the loop to break
    this.shouldStop = true;
    // this.collectedData=[];
    this.scanResultsList = [];
  }

  async startScanning() {
    if (!this.roomName || isNaN(this.x) || isNaN(this.y)) {
      alert('Please enter Room Name, X and Y coordinates first.');
      return;
    }
    this.shouldStop = false;

    try {
      await this.insomnia.keepAwake();
    } catch (err) {
      console.warn('Insomnia plugin failed:', err);
    }

    if (typeof WifiWizard2 === 'undefined') {
      console.error('WifiWizard2 not available!');
      return;
    }

    this.scanCount = 0;
    this.isScanning = true;

    // this.collectedData = []; // Clear previous data this is added later...
    this.scanResultsList = [];
    await this.scanLoop();
    if (!this.shouldStop) { this.saveJsonToFileDocuments() }
  }

  async scanLoop() {
    this.scanResultsList = [];
    while (!this.shouldStop && this.scanCount < this.totalScans) {
      try {
        const networks = await WifiWizard2.scan();
        console.log(`Scan ${this.scanCount + 1} completed`, networks);

        const wifiList = networks
          .filter((net: any) => net.SSID != null && net.SSID.trim() !== '')
          .map((net: { SSID: any; BSSID: any; level: any; frequency: any }) => ({
            ssid: net.SSID,
            bssid: net.BSSID,
            rssi: net.level,
            frequency: net.frequency
          }));

        const entry = {
          room: this.roomName,
          x: this.x,
          y: this.y,
          floor: this.f,
          scanNumber: this.scanCount + 1,
          timestamp: new Date().toISOString(), // Add timestamp
          wifi: wifiList
        };

        // this.collectedData.push(entry);
        this.scanResultsList.push(entry);

        this.scanCount++;

        // Wait 20 seconds between scans (recommended so WiFi has time to refresh)
        // await this.delay(30000);
        if (this.scanCount < this.totalScans && !this.shouldStop) {
          // Only delay if more scans remain
          await this.delay(this.scanDelay);
        }

      } catch (error) {
        console.error('Scan error:', error);
        break;
      }
      try {
        await this.insomnia.keepAwake();
      } catch (err) {
        console.warn('Insomnia plugin failed:', err);
      }

    }

    this.isScanning = false;
    // alert('Scans completed for this location!');

    try {
      await this.insomnia.allowSleepAgain();
    } catch (err) {
      console.warn('Insomnia plugin failed:', err);
    }
    if (this.shouldStop) { this.scanResultsList = []; }
    alert(this.shouldStop
      ? 'Scanning stopped.'
      : 'All scans completed!');
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  async saveJsonToFileDocuments() {

    const fileName = 'wifi_dataset.json';
    const newData = this.scanResultsList;

    try {
      // Try to read the existing file
      const read: ReadFileResult = await Filesystem.readFile({
        path: fileName,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });

      // Normalize data to string
      let text = typeof read.data === 'string'
        ? read.data
        : await read.data.text();

      // Parse with fallback on error
      let oldArray: any[];
      try {
        oldArray = JSON.parse(text);
        if (!Array.isArray(oldArray)) {
          console.warn('Existing file is not an array—overwriting.');
          oldArray = [];
        }
      } catch (parseErr) {
        console.warn('Could not parse existing JSON—overwriting.', parseErr);
        oldArray = [];
      }

      // Merge & write back
      const merged = oldArray.concat(newData);
      await Filesystem.writeFile({
        path: fileName,
        directory: Directory.Documents,
        data: JSON.stringify(merged, null, 2),
        encoding: Encoding.UTF8,
      });
      alert('✅ Appended to wifi_dataset.json in Documents');
    }
    catch (err: any) {
      const msg = err.message || err;
      // 5) if missing, create it anew
      if (msg.includes('File does not exist')) {
        try {
          await Filesystem.writeFile({
            path: fileName,
            directory: Directory.Documents,
            data: JSON.stringify(newData, null, 2),
            encoding: Encoding.UTF8,
          });
          alert('✅ Created wifi_dataset.json in Documents');
        } catch (writeErr: any) {
          console.error('Write failed:', writeErr);
          alert('❌ Failed to create file: ' + writeErr.message);
        }
      } else {
        console.error('Filesystem error:', err);
        alert('❌ Filesystem error: ' + msg);
      }
    }
  }


  downloadJSON() {
    const blob = new Blob([JSON.stringify(this.scanResultsList, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'wifi_dataset.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }
  saveJsonToFile() {
    const fileName = 'wifi_dataset.json';
    const data = JSON.stringify(this.scanResultsList, null, 2);

    this.file.writeFile(this.file.dataDirectory, fileName, data, { replace: true })
      .then(() => {
        console.log('File saved successfully in app internal storage');
        alert('Dataset saved inside app storage!');
      })
      .catch(err => {
        console.error('Error saving file:', err);
        alert('Failed to save file.');
      });
  }




  openMapPicker() {
    this.mapPickerOpen = true;
  }

  closeMapPicker() {
    if (this.pickerMap) {
      this.lastCenter = this.pickerMap.getCenter();
      this.lastZoom   = this.pickerMap.getZoom();
    }
    this.mapPickerOpen = false;
  }

  initMapPicker() {
    const img = new Image();
    img.src = 'assets/floormap/U1F_floorplan_with_2x2m_grid_600dpi2.png';
    if (this.pickerMap) {
      // restore last view if we have one
      if (this.lastCenter && this.lastZoom != null) {
        this.pickerMap.setView(this.lastCenter, this.lastZoom);
      }
      return;
    }


    // initialize a small CRS.Simple Leaflet map
    this.pickerMap = L.map('mapPicker', {
      crs: L.CRS.Simple,
      zoomSnap: 0.5,
      minZoom: -3,
      maxZoom: 4,
      zoom: 1.5,
      attributionControl: false
    });

    // compute bounds from your image size:
    img.onload = () => {
      const imgW = img.naturalWidth,
        imgH = img.naturalHeight;
      if (!this.pickerMap) {
        return;
      }
      const sw = this.pickerMap.unproject([0, imgH], 0);
      const ne = this.pickerMap.unproject([imgW, 0], 0);

      const bounds = new L.LatLngBounds(sw, ne);

      L.imageOverlay(img.src, bounds).addTo(this.pickerMap!);
      this.pickerMap.setMaxBounds(bounds);
      // this.pickerMap.fitBounds(bounds);

      // listen for clicks
      this.pickerMap.on('click', e => this.onMapPick(e));
    }
  }

  private onMapPick(e: L.LeafletMouseEvent) {
    // remove old marker
    if (this.pickerMarker && this.pickerMap) {
      this.pickerMap.removeLayer(this.pickerMarker);
    }

    // show a little marker
    const pinIcon = L.icon({
      iconUrl: 'assets/icon/marker-icon.png',
      shadowUrl: 'assets/icon/marker-shadow.png',     // optional but gives you the classic drop‐shadow
      iconSize: [25, 41],  // size of the icon
      iconAnchor: [12, 41],  // point of the icon which will correspond to marker’s location
      popupAnchor: [1, -34],  // point from which popups will "open", relative to the iconAnchor
      shadowSize: [41, 41]   // same for the shadow image
    });

    // this.pickerMarker = L.marker(e.latlng).addTo(this.pickerMap);
    this.pickerMarker = L.marker(e.latlng, 
      { icon: pinIcon }).addTo(this.pickerMap!);

    // convert back to your 600dpi‐pixel coords at zoom=0:
    if (!this.pickerMap) {
      return;
    }
    const px = this.pickerMap.project(e.latlng, 0);
    // then to meters:
    const xm = (px.x - this.x0_px) / this.pixPerM;
    const ym = (this.y0_px - px.y) / this.pixPerM;

    // round and assign
    this.x = parseFloat(xm.toFixed(2));
    this.y = parseFloat(ym.toFixed(2));

    // close the modal if you like:
    // this.closeMapPicker();
  }

  ngAfterViewInit() {
    const img = new Image();
    img.src = 'assets/floormap/U1F_floorplan_with_2x2m_grid_600dpi2.png';
   // initialize a small CRS.Simple Leaflet map
    this.pickerMap = L.map('mapPicker', {
      crs: L.CRS.Simple,
      zoomSnap: 0.5,
      minZoom: -3,
      maxZoom: 4,
      zoom: 1.5,
      attributionControl: false
    });
     img.onload = () => {
      const imgW = img.naturalWidth,
        imgH = img.naturalHeight;
      if (!this.pickerMap) {
        return;
      }
      const sw = this.pickerMap.unproject([0, imgH], 0);
      const ne = this.pickerMap.unproject([imgW, 0], 0);

      const bounds = new L.LatLngBounds(sw, ne);

      L.imageOverlay(img.src, bounds).addTo(this.pickerMap!);
      this.pickerMap.setMaxBounds(bounds);
      // this.pickerMap.fitBounds(bounds);
        // compute the geographic center of your floor-plan
  const center = bounds.getCenter();

  // now set the view to that center, at zoom level 3 (or whatever you like)
  this.pickerMap!.setView(center, -2);

      // listen for clicks
      this.pickerMap.on('click', e => this.onMapPick(e));
    }

  }
}
