// metro.config.js
const { getDefaultConfig } = require('@react-native/metro-config');

const config = getDefaultConfig(__dirname);

// Disable Watchman and reduce file watching to avoid EMFILE errors
config.watchFolders = [__dirname];
config.server = {
  ...config.server,
  useGlobalHotkey: false,
};
config.resolver = {
  ...config.resolver,
  blacklistRE: /.*\/node_modules\/.*(\/\.cache|\/\.git).*/,
};
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

// 👇 This is the key fix
config.resetCache = true;
config.cacheStores = [];
config.maxWorkers = 2; // reduce parallelism

module.exports = config;