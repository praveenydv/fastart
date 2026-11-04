const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Ignore native build artifacts, Gradle caches, and Cargo target folders to prevent reload loops
const nativeBuildExclusions = [
  /.*\/android\/app\/build\/.*/,
  /.*\/modules\/.*\/build\/.*/,
  /.*\/modules\/.*\/\.cxx\/.*/,
  /.*\/rust\/target\/.*/,
  /.*\/\.gradle\/.*/,
  /.*\/rea-capcut\/.*/,
];

if (Array.isArray(config.resolver.blockList)) {
  config.resolver.blockList.push(...nativeBuildExclusions);
} else if (config.resolver.blockList) {
  config.resolver.blockList = [config.resolver.blockList, ...nativeBuildExclusions];
} else {
  config.resolver.blockList = nativeBuildExclusions;
}

// Enable Cross-Origin Isolation for high-speed multi-threaded WebAssembly & WebGPU
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
