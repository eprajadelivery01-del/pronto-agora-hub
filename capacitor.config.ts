import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.epraja.lojista',
  appName: 'É Pra Já - Lojista',
  webDir: 'dist',
  backgroundColor: '#0D0D0D',
  android: {
    backgroundColor: '#0D0D0D',
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#0D0D0D',
      style: 'DARK',
      overlaysWebView: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "notification_sound.mp3",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  }
};

export default config;
