/* eslint-disable @typescript-eslint/no-var-requires -- Node loads this file directly as CommonJS, before any bundler/Babel transform runs. */
const path = require('path');

// The Expo CLI only auto-loads `.env` from this app's own directory, but this
// monorepo keeps a single `.env` at the workspace root — load it explicitly so
// EXPO_PUBLIC_* vars (e.g. Supabase URL/anon key) reach the app instead of
// silently falling back to the placeholder defaults in packages/supabase.
// dotenv.config() never overrides vars already set in process.env, so this is
// a no-op wherever EAS/CI injects them directly.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force project root to the actual app directory (not workspace root)
config.projectRoot = __dirname;

module.exports = config;
