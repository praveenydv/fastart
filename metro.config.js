const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add wasm to asset extensions for Rust WebAssembly backend
config.resolver.assetExts.push("wasm");

// Ignore native build artifacts, Gradle caches, and Cargo target folders to prevent reload loops
const nativeBuildExclusions = [
  /.*\/android\/app\/build\/.*/,
  /.*\/modules\/.*\/build\/.*/,
  /.*\/modules\/.*\/\.cxx\/.*/,
  /.*\/rust\/target\/.*/,
  /.*\/\.gradle\/.*/,
];

if (Array.isArray(config.resolver.blockList)) {
  config.resolver.blockList.push(...nativeBuildExclusions);
} else if (config.resolver.blockList) {
  config.resolver.blockList = [config.resolver.blockList, ...nativeBuildExclusions];
} else {
  config.resolver.blockList = nativeBuildExclusions;
}

module.exports = config;
