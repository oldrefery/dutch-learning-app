const { getDefaultConfig } = require('@expo/metro-config')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

// Get default Expo config first
const defaultConfig = getDefaultConfig(__dirname)

// Apply Sentry modifications to the default config
const config = getSentryExpoConfig(__dirname, defaultConfig)

module.exports = config
