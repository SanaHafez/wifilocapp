// import { NgModule } from '@angular/core';
// import { BrowserModule } from '@angular/platform-browser';
// import { RouteReuseStrategy } from '@angular/router';

// import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

// import { AppComponent } from './app.component';
// import { AppRoutingModule } from './app-routing.module';

// import { File } from '@awesome-cordova-plugins/file/ngx';
// import { WifiWizard2 } from '@awesome-cordova-plugins/wifi-wizard-2/ngx';
// import { Insomnia } from '@awesome-cordova-plugins/insomnia/ngx';
// // import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
// import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';
// // import { Permissions } from '@capacitor/permissions';


// @NgModule({
//   declarations: [AppComponent],
//   imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
//   providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
//     WifiWizard2,File,Insomnia,],
//   bootstrap: [AppComponent],
// })
// export class AppModule {}
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent }   from './app.component';
import { AppRoutingModule } from './app-routing.module';

// Cordova‑plugin wrappers (only those you actually use)
import { File }      from '@awesome-cordova-plugins/file/ngx';
import { WifiWizard2 } from '@awesome-cordova-plugins/wifi-wizard-2/ngx';
import { Insomnia }  from '@awesome-cordova-plugins/insomnia/ngx';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    File,
    WifiWizard2,
    Insomnia,
    AndroidPermissions
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
