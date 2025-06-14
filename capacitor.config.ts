import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:  'io.ionic.starter',
  appName: 'WifiLocApp',
  webDir: 'www',

  android: {
    allowMixedContent: true
  },
  cordova: {
    preferences: {
      ScrollEnabled: 'false',
      BackupWebStorage: 'none',
      SplashMaintainAspectRatio: 'true',
      FadeSplashScreenDuration: '300',
      SplashShowOnlyFirstTime: 'false',
      SplashScreen: 'screen',
      SplashScreenDelay: '3000'
    }
  }
};

export default config;
