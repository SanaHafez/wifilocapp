# Indoor Wi-Fi Localization & Navigation

An end-to-end Ionic/Capacitor app for indoor positioning and path-planning using Wi-Fi fingerprinting, occupancy grids, A*/Dijkstra routing, and Kalman filtering—all powered by a Google Cloud Function backend.

---

## 🚀 Features

- **Wi-Fi Fingerprinting**  
  - Scan nearby APs on Android.
  - send RSSI vectors to a cloud function.
  - receive `(room, x, y)` estimates.

- **Cloud-hosted ML Models**  
  - **Room Classifier** (`RandomForestClassifier`)  
  - **Coordinate Regressor** (`RandomForestRegressor`)  
  Both models are served via a Python 3.9 Google Cloud Function.

- **Map Overlay & Path Planning**  
  - 600 dpi floor-plan PNG overlaid in a Leaflet `CRS.Simple` map.  
  - Build an occupancy grid from black-wall pixels.  
  - Compute shortest‐path with A* or Dijkstra over a 4-connected grid.

- **Real-time Tracking & Smoothing**  
  - “Locate” button to get one-off position fixes.  
  - Fab toggle to start/stop continuous tracking at 1 Hz.  
  - 2D constant-velocity Kalman filter to smooth your moving dot.

- **Room Picker & X/Y Entry**  
  - Dropdown of room IDs → automatically centers map on room-center coordinates.  
  - Manual “X/Y” form → pan & add green target marker.

- **Map Picker Modal**  
  Tap anywhere on a zoomable mini-map to choose custom `(x, y)` for data collection or navigation.

---

## 🏗 Architecture

[Android App] <–HTTP/JSON→ [Cloud Function]
  - WifiWizard2.scan()
  - scikit-learn / XGBoost
  - Leaflet (CRS.Simple) overlay
  - Flask + functions_framework
  - A* / Dijkstra in TS
  - Pandas → feature-vector
  - Kalman filter in TS
  - room + coordinate localization

# PREREQUISITES
 - Node.js ≥20 & npm
 - Ionic CLI 7.2 & Capacitor
 - Android SDK
 - Python 3.9 + pip: functions-framework, google-cloud-storage, scikit-learn, pandas
   
# GETTING STARTED   
```txt

#Mobile App Setup
git clone https://github.com/SanaHafez/wifilocapp.git
cd wifilocapp

# 1. Install node dependencies
npm install

# 2. Build the web assets
npm run build

# 3. Install/sync native plugins & platforms
npx cap sync

# Or run all in one line:
npm install && npm run build && npx cap sync
