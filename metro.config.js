// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Firebase v10+ uses the package.json `exports` field for module resolution.
// Metro needs this flag to honour it; without it the bundler falls back to
// the `main` field which points to an ESM file that doesn't exist on disk.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["require", "default", "browser"];

module.exports = config;
