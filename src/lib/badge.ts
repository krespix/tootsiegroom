import { getSetting, unfilledAppointments } from "../db/repo";

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/** Chrome on Android exposes setAppBadge but launchers ignore it: there a badge only follows unread notifications. */
export const isAndroid = () => /Android/i.test(navigator.userAgent);
export const badgeSupported = () => "setAppBadge" in navigator && !isAndroid();
export const badgeOn = () => getSetting("badge_off") !== "1";

/** The home-screen icon shows how many past visits still need filling in. */
export function updateBadge() {
  const nav = navigator as BadgeNavigator;
  if (!nav.setAppBadge || !nav.clearAppBadge) return;
  const n = badgeOn() ? unfilledAppointments().length : 0;
  (n ? nav.setAppBadge(n) : nav.clearAppBadge()).catch(() => {
    // iOS refuses until notifications are allowed; settings explain how to turn it on
  });
}
