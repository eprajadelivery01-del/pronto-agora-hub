// Shims de tipos para pacotes Capacitor cujo conteúdo completo (dist/)
// não é instalado neste ambiente. O app web não usa as APIs nativas;
// estas declarações apenas permitem que o typecheck passe.
declare module "@capacitor/status-bar" {
  export const StatusBar: any;
  export const Style: any;
  export type StyleOptions = any;
  export type StatusBarInfo = any;
  export type Animation = any;
  const _default: any;
  export default _default;
}

declare module "@capacitor/local-notifications" {
  export const LocalNotifications: any;
  export type LocalNotificationSchema = any;
  export type PendingResult = any;
  export type PermissionStatus = any;
  export type ScheduleOptions = any;
  const _default: any;
  export default _default;
}

declare module "@capacitor/push-notifications" {
  export const PushNotifications: any;
  export type Token = any;
  export type PushNotificationSchema = any;
  export type ActionPerformed = any;
  export type PermissionStatus = any;
  const _default: any;
  export default _default;
}

declare module "@capacitor-firebase/messaging" {
  export const FirebaseMessaging: any;
  export type GetTokenOptions = any;
  export type NotificationReceivedEvent = any;
  export type PermissionStatus = any;
  const _default: any;
  export default _default;
}
