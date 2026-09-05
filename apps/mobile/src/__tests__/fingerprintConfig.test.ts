import { spawnSync } from 'node:child_process'
import path from 'node:path'

const mobileRoot = path.resolve(__dirname, '../..')
const fingerprintProbe = `
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { normalizeOptionsAsync } = require('@expo/fingerprint/build/Options');
  const { createFingerprintFromSourcesAsync } = require('@expo/fingerprint/build/hash/Hash');

  async function main() {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'woordenaar-fingerprint-'));
    const appRoot = path.join(fixture, 'apps/mobile');
    const dependencyPath = '../../node_modules/@sentry/react-native';
    const dependencyRoot = path.resolve(appRoot, dependencyPath);
    const write = (relativePath, content) => {
      const file = path.resolve(appRoot, relativePath);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    };
    // Exercise Expo's ignore parser and hasher without unrelated autolinking discovery.
    const fingerprint = async () => {
      const options = await normalizeOptionsAsync(appRoot, {
        silent: true,
        platforms: [process.env.FINGERPRINT_TEST_PLATFORM],
      });
      return createFingerprintFromSourcesAsync(
        [{ type: 'dir', filePath: dependencyPath, reasons: ['test'] }],
        appRoot,
        options
      );
    };
    try {
      write('package.json', JSON.stringify({ name: 'fingerprint-fixture', version: '1.0.0' }));
      write('.fingerprintignore', fs.readFileSync('.fingerprintignore', 'utf8'));
      write(dependencyPath + '/package.json', JSON.stringify({ name: '@sentry/react-native', version: '8.25.0' }));
      write(dependencyPath + '/android/expo-handler/src/main/Handler.kt', 'original source');
      const clean = await fingerprint();
      write(dependencyPath + '/android/expo-handler/build/intermediates/classes/Handler.class', 'generated output');
      const built = await fingerprint();
      write(dependencyPath + '/android/expo-handler/build/intermediates/classes/Handler.class', 'rebuilt output');
      const rebuilt = await fingerprint();
      write(dependencyPath + '/android/expo-handler/src/main/Handler.kt', 'changed source');
      const sourceChanged = await fingerprint();
      write(dependencyPath + '/android/expo-handler/src/main/Handler.kt', 'original source');
      write(dependencyPath + '/android/expo-handler/build.gradle', 'changed build configuration');
      const configChanged = await fingerprint();
      fs.unlinkSync(path.join(dependencyRoot, 'android/expo-handler/build.gradle'));
      write('.fingerprintignore', '');
      const withoutIgnore = await fingerprint();
      console.log(JSON.stringify({
        clean: clean.hash,
        built: built.hash,
        rebuilt: rebuilt.hash,
        sourceChanged: sourceChanged.hash,
        configChanged: configChanged.hash,
        withoutIgnore: withoutIgnore.hash,
        dependencyHash: clean.sources.find(source => source.filePath === dependencyPath)?.hash,
      }));
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  }
  main().catch(error => { console.error(error); process.exitCode = 1; });
`

describe('mobile fingerprint configuration', () => {
  it.each(['android', 'ios'])(
    'ignores only generated Sentry output for %s',
    platform => {
      const result = spawnSync(process.execPath, ['-e', fingerprintProbe], {
        cwd: mobileRoot,
        encoding: 'utf8',
        timeout: 20_000,
        env: {
          ...process.env,
          EXPO_NO_DOTENV: '1',
          FINGERPRINT_TEST_PLATFORM: platform,
        },
      })

      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      const hashes = JSON.parse(result.stdout)
      expect(hashes.dependencyHash).toEqual(expect.any(String))
      expect(hashes.built).toBe(hashes.clean)
      expect(hashes.rebuilt).toBe(hashes.clean)
      expect(hashes.sourceChanged).not.toBe(hashes.clean)
      expect(hashes.configChanged).not.toBe(hashes.clean)
      expect(hashes.withoutIgnore).not.toBe(hashes.clean)
    }
  )
})
