import { Component } from '@angular/core';
import { Platform }             from '@ionic/angular';
import { StatusBar, Style }     from '@capacitor/status-bar';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private platform: Platform) {
    this.initializeApp();
  }

  private async initializeApp() {
    await this.platform.ready();

    // Make sure the webview does NOT cover the status bar:
    await StatusBar.setOverlaysWebView({ overlay: true });

    // Show the status bar and choose a style (light or dark text)
    await StatusBar.show();
    await StatusBar.setStyle({ style: Style.Light });
  }
}