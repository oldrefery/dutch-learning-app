// app.config.js
import appJson from './app.base.json'

export default () => {
  const isQaBuild = process.env.WOORDENAAR_QA_BUILD === 'true'
  const buildProfile = process.env.EAS_BUILD_PROFILE

  if (
    isQaBuild &&
    ['preview', 'production', 'dictionary-release'].includes(buildProfile)
  ) {
    throw new Error(
      'WOORDENAAR_QA_BUILD cannot be used with preview, production or dictionary-release'
    )
  }

  if (buildProfile === 'dictionary-release') {
    const iosBuild = appJson.expo.ios.buildNumber
    const androidBuild = appJson.expo.android.versionCode
    if (
      !/^[1-9][0-9]*$/.test(iosBuild) ||
      !Number.isSafeInteger(androidBuild) ||
      Number(iosBuild) !== androidBuild ||
      androidBuild <= 85 ||
      androidBuild > 2100000000
    ) {
      throw new Error(
        'dictionary-release requires matching new build numbers greater than 85; verify store availability before version preparation'
      )
    }
    for (const key of [
      'EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED',
      'EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED',
      'EXPO_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED',
      'EXPO_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED',
    ]) {
      if (process.env[key] !== 'true')
        throw new Error(`dictionary-release requires ${key}=true`)
    }
    if (
      process.env.WOORDENAAR_QA_BUILD !== 'false' ||
      process.env.EXPO_PUBLIC_E2E_TEST_MODE !== 'false'
    ) {
      throw new Error(
        'dictionary-release requires explicit production isolation'
      )
    }
  }

  return {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      qaBuild: isQaBuild,
    },
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
