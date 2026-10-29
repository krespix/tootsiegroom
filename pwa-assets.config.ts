import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Icons come from the round TootsieGroom logo. Where the platform needs a full
// square (iOS home screen, Android maskable), it sits on the app background.
const background = "#FAF6F8";

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.12, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0.06, resizeOptions: { background } },
  },
  images: ["public/logo.png"],
});
