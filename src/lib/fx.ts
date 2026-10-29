/** Animations are off when the user turned them off in settings or the system asks for reduced motion. */
export function fxEnabled() {
  return !document.documentElement.classList.contains("no-fx") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const PAW =
  '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><circle cx="7" cy="9" r="2.2"/><circle cx="12" cy="5.5" r="2.2"/><circle cx="17" cy="9" r="2.2"/><path d="M8 17.5c0-3 1.8-5.5 4-5.5s4 2.5 4 5.5c0 1.8-1.8 2.5-4 2s-4 .2-4-2z"/></svg>';
const COLORS = ["#D81B60", "#7B4A93", "#F2A93B", "#2E9E77", "#F48FB1"];

/** A burst of paw prints flying up from the bottom of the screen. */
export function celebrate(big = false) {
  if (!fxEnabled()) return;
  const layer = document.createElement("div");
  layer.className = "paws";
  layer.setAttribute("aria-hidden", "true");
  const n = big ? 26 : 12;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = "paw";
    p.innerHTML = PAW;
    const size = 18 + Math.random() * (big ? 22 : 14);
    p.style.cssText = [
      `left:${5 + Math.random() * 90}%`,
      `width:${size}px`,
      `height:${size}px`,
      `color:${COLORS[i % COLORS.length]}`,
      `animation-delay:${Math.random() * (big ? 600 : 300)}ms`,
      `--dx:${(Math.random() - 0.5) * 160}px`,
      `--rot:${(Math.random() - 0.5) * 120}deg`,
    ].join(";");
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 2600);
}
