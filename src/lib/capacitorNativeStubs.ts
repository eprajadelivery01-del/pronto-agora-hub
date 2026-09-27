import { registerPlugin } from "@capacitor/core";

// Ponte inteligente de plugins Capacitor:
// - No ambiente NATIVO (iOS / Android), o registerPlugin conecta diretamente à
//   implementação Swift / Kotlin / Java dos plugins (FCM, APNs, som, badge e canais).
// - No ambiente WEB / preview (Lovable), o registerPlugin utiliza o fallback fornecido,
//   evitando quebras de compilação no Vite e garantindo build e publicação 100% limpos.

export const StatusBar = registerPlugin<any>("StatusBar", {
  web: () => ({
    setOverlaysWebView: async () => {},
    setStyle: async () => {},
    setBackgroundColor: async () => {},
    hide: async () => {},
    show: async () => {},
    getInfo: async () => ({ visible: true }),
  }),
});

export const Style = {
  Dark: "DARK",
  Light: "LIGHT",
  Default: "DEFAULT",
} as const;

export const LocalNotifications = registerPlugin<any>("LocalNotifications", {
  web: () => ({
    requestPermissions: async () => ({ display: "denied" }),
    checkPermissions: async () => ({ display: "denied" }),
    createChannel: async () => {},
    deleteChannel: async () => {},
    schedule: async () => ({ notifications: [] }),
    getPending: async () => ({ notifications: [] }),
    cancel: async () => {},
    addListener: async () => ({ remove: async () => {} }),
    removeAllListeners: async () => {},
  }),
});

export const PushNotifications = registerPlugin<any>("PushNotifications", {
  web: () => ({
    requestPermissions: async () => ({ receive: "denied" }),
    checkPermissions: async () => ({ receive: "denied" }),
    register: async () => {},
    addListener: async () => ({ remove: async () => {} }),
    removeAllListeners: async () => {},
  }),
});

export const FirebaseMessaging = registerPlugin<any>("FirebaseMessaging", {
  web: () => ({
    requestPermissions: async () => ({ receive: "denied" }),
    checkPermissions: async () => ({ receive: "denied" }),
    getToken: async () => ({ token: "" }),
    deleteToken: async () => {},
    createChannel: async () => {},
    deleteChannel: async () => {},
    addListener: async () => ({ remove: async () => {} }),
    removeAllListeners: async () => {},
  }),
});
