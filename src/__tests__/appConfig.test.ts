import fs from 'node:fs'
import path from 'node:path'

interface ExpoAudioPluginOptions {
  microphonePermission?: string | false
  recordAudioAndroid?: boolean
  enableBackgroundRecording?: boolean
  enableBackgroundPlayback?: boolean
}

interface AppConfig {
  expo: {
    ios: { infoPlist?: Record<string, unknown> }
    android: { permissions?: string[]; blockedPermissions?: string[] }
    plugins: (string | [string, ExpoAudioPluginOptions])[]
  }
}

describe('native capability configuration', () => {
  const config = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'app.base.json'), 'utf8')
  ) as AppConfig

  it('keeps Audio Review foreground-only and playback-only', () => {
    const expoAudioPlugin = config.expo.plugins.find(
      plugin => Array.isArray(plugin) && plugin[0] === 'expo-audio'
    )

    expect(expoAudioPlugin).toEqual([
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ])
    expect(config.expo.ios.infoPlist).toHaveProperty('UIBackgroundModes', [])
    expect(config.expo.android.permissions).not.toContain(
      'android.permission.RECORD_AUDIO'
    )
    expect(config.expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.RECORD_AUDIO',
        'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      ])
    )
    expect(config.expo.plugins).toContain('expo-asset')
  })
})
