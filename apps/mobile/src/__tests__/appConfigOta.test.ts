import { spawnSync } from 'node:child_process'
import path from 'node:path'
import appJson from '../../app.base.json'
import easJson from '../../eas.json'

const mobileRoot = path.resolve(__dirname, '../..')
const configProbe = `
  const { getConfig } = require('@expo/config');
  const { IOSConfig, AndroidConfig } = require('@expo/config-plugins');
  async function main() {
    const { exp } = getConfig(process.cwd(), { skipPlugins: true });
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
      updates: exp.updates,
      runtimeVersion: exp.runtimeVersion,
      experiments: exp.experiments,
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

  it.each(['preview', 'production'])(
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
