import { spawnSync } from 'node:child_process'
import path from 'node:path'
import {
  copyFileSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import appJson from '../../app.base.json'
import easJson from '../../eas.json'

const DICTIONARY_RELEASE_PROFILE = 'dictionary-release'
const mobileRoot = path.resolve(__dirname, '../..')
const configProbe = `
  const { getConfig } = require('@expo/config');
  const { IOSConfig, AndroidConfig } = require('@expo/config-plugins');
  async function main() {
    const { exp } = getConfig(process.env.CONFIG_TEST_ROOT || process.cwd(), { skipPlugins: true });
    const ios = await IOSConfig.Updates.setUpdatesConfigAsync(process.cwd(), exp, {});
    const android = await AndroidConfig.Updates.setUpdatesConfigAsync(
      process.cwd(), exp, {
        manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] }
      }
    );
    const enabled = android.manifest.application[0]['meta-data'].find(
      entry => entry.$['android:name'] === 'expo.modules.updates.ENABLED'
    );
    console.log(JSON.stringify({
      version: exp.version,
      iosBuild: exp.ios.buildNumber,
      androidBuild: exp.android.versionCode,
      owner: exp.owner,
      iosBundle: exp.ios.bundleIdentifier,
      androidPackage: exp.android.package,
      updates: exp.updates,
      runtimeVersion: exp.runtimeVersion,
      experiments: exp.experiments,
      qaBuild: exp.extra.qaBuild,
      iosEnabled: ios.EXUpdatesEnabled,
      androidEnabled: enabled.$['android:value'],
    }));
  }
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
`

function readConfig(env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['-e', configProbe], {
    cwd: mobileRoot,
    encoding: 'utf8',
    timeout: 15_000,
    env: {
      ...process.env,
      EXPO_NO_DOTENV: '1',
      WOORDENAAR_QA_BUILD: '',
      EAS_BUILD_PROFILE: '',
      CONFIG_TEST_ROOT: '',
      ...env,
    },
  })
}

describe('mobile OTA build configuration', () => {
  it.each(['', 'false', '1', 'TRUE'])(
    'preserves normal updates for QA flag %j',
    flag => {
      const result = readConfig({ WOORDENAAR_QA_BUILD: flag })

      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        updates: appJson.expo.updates,
        runtimeVersion: appJson.expo.runtimeVersion,
        experiments: { nativeTabs: true, typedRoutes: true },
        qaBuild: false,
        iosEnabled: true,
        androidEnabled: 'true',
      })
    }
  )

  it('disables both native updaters for a local QA build', () => {
    const result = readConfig({ WOORDENAAR_QA_BUILD: 'true' })

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      updates: { ...appJson.expo.updates, enabled: false },
      qaBuild: true,
      runtimeVersion: appJson.expo.runtimeVersion,
      iosEnabled: false,
      androidEnabled: 'false',
    })
  })

  it('uses the same OTA policy in the actual E2E profile', () => {
    const result = readConfig({
      ...easJson.build['e2e-test'].env,
      EAS_BUILD_PROFILE: 'e2e-test',
    })

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      iosEnabled: false,
      androidEnabled: 'false',
    })
  })

  it.each(['preview', 'production'] as const)(
    'preserves OTA for %s',
    profile => {
      expect(easJson.build[profile].channel).toBe(profile)
      const result = readConfig({ EAS_BUILD_PROFILE: profile })

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        iosEnabled: true,
        androidEnabled: 'true',
      })
    }
  )

  it('rejects the used build85 in the dictionary release profile', () => {
    const result = readConfig({
      ...easJson.build[DICTIONARY_RELEASE_PROFILE].env,
      EAS_BUILD_PROFILE: DICTIONARY_RELEASE_PROFILE,
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('new build numbers greater than 85')
  })

  describe('new dictionary build configuration', () => {
    let fixture: string
    beforeEach(() => {
      fixture = mkdtempSync(path.join(tmpdir(), 'dictionary-build-config-'))
      copyFileSync(
        path.join(mobileRoot, 'app.config.js'),
        path.join(fixture, 'app.config.js')
      )
      writeFileSync(
        path.join(fixture, 'package.json'),
        JSON.stringify({ name: 'config-fixture', version: '2.4.0' })
      )
      symlinkSync(
        path.resolve(mobileRoot, '../../node_modules'),
        path.join(fixture, 'node_modules'),
        'dir'
      )
      writeFixture(86, '86')
    })
    afterEach(() => rmSync(fixture, { recursive: true, force: true }))
    function writeFixture(android: number, ios: string) {
      writeFileSync(
        path.join(fixture, 'app.base.json'),
        JSON.stringify({
          expo: {
            ...appJson.expo,
            ios: { ...appJson.expo.ios, buildNumber: ios },
            android: { ...appJson.expo.android, versionCode: android },
          },
        })
      )
    }
    function probe(overrides: Record<string, string> = {}) {
      return readConfig({
        ...easJson.build[DICTIONARY_RELEASE_PROFILE].env,
        EAS_BUILD_PROFILE: DICTIONARY_RELEASE_PROFILE,
        CONFIG_TEST_ROOT: fixture,
        ...overrides,
      })
    }
    it('resolves a synthetic new build with production OTA and all following features', () => {
      const result = probe()
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        qaBuild: false,
        iosEnabled: true,
        androidEnabled: 'true',
        runtimeVersion: { policy: 'fingerprint' },
        version: '2.4.0',
        iosBuild: '86',
        androidBuild: 86,
        owner: 'oldrefery',
        iosBundle: 'com.oldrefery.dutch-learning-app',
        androidPackage: 'com.oldrefery.dutchlearningapp',
      })
      expect(easJson.build[DICTIONARY_RELEASE_PROFILE].extends).toBe(
        'production'
      )
      expect(easJson.build.production.autoIncrement).toBe(false)
      expect(easJson.cli.appVersionSource).toBe('local')
      expect(
        easJson.submit[DICTIONARY_RELEASE_PROFILE].android.releaseStatus
      ).toBe('draft')
    })
    it.each([
      'EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED',
      'EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED',
      'EXPO_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED',
      'EXPO_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED',
    ])('rejects missing or disabled feature %s', key => {
      for (const value of ['', 'false', 'TRUE']) {
        const result = probe({ [key]: value })
        expect(result.status).toBe(1)
        expect(result.stderr).toContain(`requires ${key}=true`)
      }
    })
    it.each([
      [85, '86'],
      [86, '87'],
      [86.5, '86.5'],
      [86, '086'],
      [2100000001, '2100000001'],
    ])('rejects mismatched or invalid build pair %s/%s', (android, ios) => {
      writeFixture(Number(android), String(ios))
      expect(probe().status).toBe(1)
    })
    it.each(['WOORDENAAR_QA_BUILD', 'EXPO_PUBLIC_E2E_TEST_MODE'])(
      'requires explicit disabled test mode %s',
      key => {
        for (const value of ['', 'true', 'FALSE'])
          expect(probe({ [key]: value }).status).toBe(1)
      }
    )
  })

  it.each(['preview', 'production', DICTIONARY_RELEASE_PROFILE])(
    'rejects a QA flag leaking into %s',
    profile => {
      const result = readConfig({
        EAS_BUILD_PROFILE: profile,
        WOORDENAAR_QA_BUILD: 'true',
      })

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('WOORDENAAR_QA_BUILD cannot be used')
    }
  )
})
