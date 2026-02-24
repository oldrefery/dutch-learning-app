const { getDefaultConfig } = require('@expo/metro-config')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const path = require('path')

// Get default Expo config first
const defaultConfig = getDefaultConfig(__dirname)

// Apply Sentry modifications to the default config
const config = getSentryExpoConfig(__dirname, defaultConfig)

// Keep @/ imports stable in local EAS bundle step (expo export:embed).
config.resolver = config.resolver || {}
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@': path.resolve(__dirname, 'src'),
}

module.exports = config
