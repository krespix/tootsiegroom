import { getSetting, unfilledAppointments } from "../db/repo";

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/**
 * The badge is an iPhone feature here: Android launchers ignore web app badges,
 * and on a computer it is not wanted. iPadOS reports itself as a Mac with touch.
 */
export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
export const badgeSupported = () => "setAppBadge" in navigator && isIOS();
export const badgeOn = () => getSetting("badge_off") !== "1";

/** The home-screen icon shows how many past visits still need filling in. */
export function updateBadge() {
  const nav = navigator as BadgeNavigator;
  if (!nav.setAppBadge || !nav.clearAppBadge || !isIOS()) return;
  const n = badgeOn() ? unfilledAppointments().length : 0;
  (n ? nav.setAppBadge(n) : nav.clearAppBadge()).catch(() => {
    // iOS refuses until notifications are allowed; settings explain how to turn it on
  });
}
