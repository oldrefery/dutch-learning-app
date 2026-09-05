// app.config.js
import appJson from './app.base.json'

export default () => {
  const isQaBuild = process.env.WOORDENAAR_QA_BUILD === 'true'
  const buildProfile = process.env.EAS_BUILD_PROFILE

  if (isQaBuild && ['preview', 'production'].includes(buildProfile)) {
    throw new Error(
      'WOORDENAAR_QA_BUILD cannot be used with preview or production'
    )
  }

  return {
    ...appJson.expo,
    // Disable the native updater too, not just the Settings status check.
    updates: {
      ...appJson.expo.updates,
      ...(isQaBuild ? { enabled: false } : {}),
    },
    experiments: {
      ...(appJson.expo.experiments ?? {}),
      nativeTabs: true,
      typedRoutes: true,
    },
  }
}
