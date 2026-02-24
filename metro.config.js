const { getDefaultConfig } = require('@expo/metro-config')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const path = require('path')

// Get default Expo config first
const defaultConfig = getDefaultConfig(__dirname)

// Apply Sentry modifications to the default config
const config = getSentryExpoConfig(__dirname, defaultConfig)

// Keep @/ imports stable in local EAS bundle step (expo export:embed).
// extraNodeModules alone is not enough for scoped-like specifiers ('@/...'),
// so we explicitly rewrite the prefix via Metro resolver hook.
config.resolver = config.resolver || {}
const srcRoot = path.resolve(__dirname, 'src')
const previousResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const rewrittenModuleName = moduleName.startsWith('@/')
    ? path.join(srcRoot, moduleName.slice(2))
    : moduleName

  if (typeof previousResolveRequest === 'function') {
    return previousResolveRequest(context, rewrittenModuleName, platform)
  }

  return context.resolveRequest(context, rewrittenModuleName, platform)
}

module.exports = config
