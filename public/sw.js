// Retired. Push notifications were removed from L-23 LIFE (2026-11). Browsers that
// registered the old worker keep checking this URL for updates; this version
// removes itself, and with it the device's old push subscription.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.registration.unregister());
});
