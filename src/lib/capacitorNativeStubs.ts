// Stubs seguros para pacotes Capacitor cujo conteúdo web (dist/) não está
// disponível neste ambiente de build. Todo o uso no código já é protegido por
// Capacitor.isNativePlatform(), então no web estes objetos nunca são chamados
// de fato — e, se forem, falham de forma silenciosa sem quebrar a página.

const resolved = <T>(value: T) => Promise.resolve(value);
const noopListener = () => Promise.resolve({ remove: () => Promise.resolve() });

export const StatusBar = {
  setOverlaysWebView: (_opts?: any) => resolved(undefined),
  setStyle: (_opts?: any) => resolved(undefined),
  setBackgroundColor: (_opts?: any) => resolved(undefined),
  hide: () => resolved(undefined),
  show: () => resolved(undefined),
  getInfo: () => resolved({ visible: true } as any),
};

export const Style = {
  Dark: "DARK",
  Light: "LIGHT",
  Default: "DEFAULT",
} as const;

export const LocalNotifications = {
  requestPermissions: () => resolved({ display: "denied" } as any),
  checkPermissions: () => resolved({ display: "denied" } as any),
  createChannel: (_channel: any) => resolved(undefined),
  deleteChannel: (_channel: any) => resolved(undefined),
  schedule: (_opts: any) => resolved({ notifications: [] } as any),
  getPending: () => resolved({ notifications: [] } as any),
  cancel: (_opts: any) => resolved(undefined),
  addListener: (_event: string, _cb: any) => noopListener(),
  removeAllListeners: () => resolved(undefined),
};

export const PushNotifications = {
  requestPermissions: () => resolved({ receive: "denied" } as any),
  checkPermissions: () => resolved({ receive: "denied" } as any),
  register: () => resolved(undefined),
  addListener: (_event: string, _cb: any) => noopListener(),
  removeAllListeners: () => resolved(undefined),
};

export const FirebaseMessaging = {
  requestPermissions: () => resolved({ receive: "denied" } as any),
  checkPermissions: () => resolved({ receive: "denied" } as any),
  getToken: (_opts?: any) => resolved({ token: "" }),
  deleteToken: () => resolved(undefined),
  createChannel: (_channel: any) => resolved(undefined),
  deleteChannel: (_channel: any) => resolved(undefined),
  addListener: (_event: string, _cb: any) => noopListener(),
  removeAllListeners: () => resolved(undefined),
};
