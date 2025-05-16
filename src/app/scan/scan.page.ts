import { Component, OnInit } from '@angular/core';
import { Platform , AlertController } from '@ionic/angular';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Insomnia } from '@awesome-cordova-plugins/insomnia/ngx';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory, Encoding,ReadFileResult  } from '@capacitor/filesystem';
import { IonHeader, IonItem, IonProgressBar } from "@ionic/angular/standalone";
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { IonicModule }    from '@ionic/angular';

declare var WifiWizard2: any;

@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ScanPage implements OnInit {
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
  shouldStop:boolean = false;

  // collectedData: any[] = [];


  constructor(private platform: Platform,
    private alertCtrl: AlertController,
    private file: File,
    private insomnia: Insomnia,
    // private androidPermissions: any
  ) {}
  async ngOnInit() {
    this.platform.ready().then(async () => {
      console.log('Platform ready');
      this.isDeviceReady = true;
  // Request location permission via the Geolocation plugin
     const perm = await Geolocation.requestPermissions();
     // perm.location can be 'granted' | 'denied' | 'prompt'
     if (perm.location !== 'granted') {
       console.warn('Location permission denied');
       return;
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
    this.scanResultsList=[];
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
    if (!this.shouldStop){this.saveJsonToFileDownloads()}
  }

  async scanLoop() {
    this.scanResultsList = [];
    while ( !this.shouldStop && this.scanCount < this.totalScans) {
      try {
        const networks = await WifiWizard2.scan();
        console.log(`Scan ${this.scanCount + 1} completed`, networks);

        const wifiList = networks
        .filter((net: any) => net.SSID != null && net.SSID.trim() !== '')
        .map((net: { SSID: any; BSSID: any; level: any; frequency:any}) => ({
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
    if (this.shouldStop){this.scanResultsList = [];}
    alert(this.shouldStop 
      ? 'Scanning stopped.' 
      : 'All scans completed!');
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  
async saveJsonToFileDownloads() {
  const fileName = 'wifi_dataset.json';
  const newData  = this.scanResultsList;

  try {
    // Try to read the existing file
    const read: ReadFileResult = await Filesystem.readFile({
      path:      fileName,
      directory: Directory.Documents,
      encoding:  Encoding.UTF8 
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
      path:      fileName,
      directory: Directory.Documents,
      data:      JSON.stringify(merged, null, 2),
      encoding:  Encoding.UTF8,
    });
    alert('✅ Appended to wifi_dataset.json in Documents');
  }
  catch (err: any) {
    // If the file doesn’t exist, create it fresh
    if (err.message?.includes('File does not exist')) {
      try {
        await Filesystem.writeFile({
          path:      fileName,
          directory: Directory.Documents,
          data:      JSON.stringify(newData, null, 2),
          encoding:  Encoding.UTF8,
        });
        alert('✅ Created wifi_dataset.json in Documents');
      } catch (writeErr: any) {
        console.error('Write failed:', writeErr);
        alert('❌ Failed to create file: ' + writeErr.message);
      }
    } else {
      console.error('Read failed:', err);
      alert('❌ Failed to read existing file: ' + err.message);
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
      });}

}
