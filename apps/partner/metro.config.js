const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force project root to the actual app directory (not workspace root)
config.projectRoot = __dirname;

module.exports = config;
