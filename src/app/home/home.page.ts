import { Component, OnInit } from '@angular/core';
import { Platform , AlertController } from '@ionic/angular';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Insomnia } from '@awesome-cordova-plugins/insomnia/ngx';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
declare var WifiWizard2: any;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})

export class HomePage implements OnInit {
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

  collectedData: any[] = [];


  constructor(private platform: Platform,
    private alertCtrl: AlertController,
    private file: File,
    private insomnia: Insomnia,
    private androidPermissions:AndroidPermissions
  ) {}

  ngOnInit() {
    this.platform.ready().then(() => {
      console.log('Platform ready');
      this.isDeviceReady = true;
      this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.ACCESS_FINE_LOCATION).then(
        result => {
          if (!result.hasPermission) {
            this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.ACCESS_FINE_LOCATION);
          }
        },
        err => this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.ACCESS_FINE_LOCATION)
      );
      this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE).then(
        result => {
          if (!result.hasPermission) {
            this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE);
          }
        },
        err => this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE)
      );
      
      // WRITE_EXTERNAL_STORAGE
      this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE).then(
        result => {
          if (!result.hasPermission) {
            this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE);
          }
        },
        err => this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)
      );
      
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

    this.collectedData = []; // Clear previous data this is added later...
    this.scanResultsList = [];
    await this.scanLoop();
  }

  async scanLoop() {
    // this.scanResultsList = [];
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

        this.collectedData.push(entry);
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
    alert(this.shouldStop 
      ? 'Scanning stopped.' 
      : 'All scans completed!');
  
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  downloadJSON() {
    const blob = new Blob([JSON.stringify(this.collectedData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'wifi_dataset.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }
  saveJsonToFile() {
    const fileName = 'wifi_dataset.json';
    const data = JSON.stringify(this.collectedData, null, 2);
  
    this.file.writeFile(this.file.dataDirectory, fileName, data, { replace: true })
      .then(() => {
        console.log('File saved successfully in app internal storage');
        alert('Dataset saved inside app storage!');
      })
      .catch(err => {
        console.error('Error saving file:', err);
        alert('Failed to save file.');
      });}

  // async saveJsonToFileDownloads() {
  //   const fileName = 'wifi_dataset.json';
  //   const path     = this.file.externalRootDirectory + 'Download/'; 
  //   const newData  = this.collectedData;

  //   try {
  //     const exists = await this.file.checkFile(path, fileName);

  //     if (exists) {
  //       // Read old content
  //       const oldContent = await this.file.readAsText(path, fileName);
  //       let oldData: any[];

  //       // Guard against null or malformed JSON
  //       try {
  //         oldData = JSON.parse(oldContent) || [];
  //       } catch {
  //         console.warn('Existing JSON invalid—starting fresh array');
  //         oldData = [];
  //       }

  //       // Merge and save
  //       const mergedData = oldData.concat(newData);
  //       await this.file.writeFile(path, fileName, JSON.stringify(mergedData, null, 2), { replace: true });

  //       console.log('New data appended to existing JSON file!');
  //       alert('New data appended to dataset!');
  //     } else {
  //       // File not found: create it
  //       await this.file.writeFile(path, fileName, JSON.stringify(newData, null, 2), { replace: true });
  //       console.log('New file created and data saved!');
  //       alert('Dataset file created!');
  //     }

  //   } catch (error: any) {
  //     console.error('Error saving file:', error);
  //     alert('Failed to save file: ' + (error.message || error));
  //   }
  // }
  async saveJsonToFileDownloads() {
    // const fileName = 'wifi_dataset.json';
    // const data = JSON.stringify(this.collectedData, null, 2);
  
    // this.file.writeFile(this.file.externalRootDirectory + 'Download/', fileName, data, { replace: true })
    //   .then(() => {
    //     console.log('File saved successfully in Downloads folder');
    //     alert('Dataset saved in Downloads folder!');
    //   })
    //   .catch(err => {
    //     console.error('Error saving file:', err);
    //     alert('Failed to save file.');
    //   });  }
    const P = this.androidPermissions.PERMISSION;
    await this.androidPermissions.requestPermissions([
      P.READ_EXTERNAL_STORAGE,
      P.WRITE_EXTERNAL_STORAGE
    ]);
    const fileName = 'wifi_dataset.json';
    const path = this.file.externalRootDirectory + 'Download/'; // Saving in Downloads folder
    const newData = this.collectedData;

    try {
      // Check if file exists first
      const exists = await this.file.checkFile(path, fileName);

      if (exists) {
        // ✅ File exists: Read old data
        const oldContent = await this.file.readAsText(path, fileName);
        const oldData = JSON.parse(oldContent);

        // ✅ Merge old data + new data
        const mergedData = oldData.concat(newData);

        // ✅ Save merged data back
        await this.file.writeFile(path, fileName, JSON.stringify(mergedData, null, 2), { replace: true });

        console.log('New data appended to existing JSON file!');
        alert('New data appended to dataset!');
      }

    } catch (error) {
      if ((error as any).code === 1) { // ✅ File not found
        // ✅ Create new file
        await this.file.writeFile(path, fileName, JSON.stringify(newData, null, 2), { replace: true });
        console.log('New file created and data saved!');
        alert('Dataset file created!');
      } else {
        console.error('Error saving file:', error);
        alert('Failed to save file.');
      }
    }
  }
}
