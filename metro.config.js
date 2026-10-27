const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add wasm to asset extensions for Rust WebAssembly backend
config.resolver.assetExts.push("wasm");

module.exports = config;
