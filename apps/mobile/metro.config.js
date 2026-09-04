const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const path = require('path')

const config = getSentryExpoConfig(__dirname)

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
