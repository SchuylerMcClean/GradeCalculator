// Fallback required by Expo Router alongside settings.android.tsx.
// On iOS and web, Settings is reached via the /settings route directly,
// not as a tab — so this file is present for resolver compatibility only.
export { default } from "../settings";
