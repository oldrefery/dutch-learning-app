// Expo config plugin: patches RCTTurboModule.mm for iOS 26 PAC crash
// See: https://github.com/facebook/react-native/pull/56265
const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

const PATCH_MARKER = '[RCTTurboModule Patch]'

function withRCTTurboModulePatch(config) {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      )

      if (!fs.existsSync(podfilePath)) {
        console.warn(`${PATCH_MARKER} Podfile not found at ${podfilePath}`)
        return config
      }

      let contents = fs.readFileSync(podfilePath, 'utf8')

      // Ruby code to inject into post_install block
      const patchRuby = `
    # --- iOS 26 PAC crash fix (react-native#56265) ---
    turbo_module_paths = Dir.glob(File.join(installer.sandbox.root, '**', 'RCTTurboModule.mm'))
    turbo_module_paths.each do |turbo_module_file|
      content = File.read(turbo_module_file)
      bad_line = 'throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);'
      if content.scan(bad_line).length > 0
        idx = content.rindex(bad_line)
        if idx
          content = content[0...idx] + '@throw exception; // patched: react-native#56265' + content[(idx + bad_line.length)..]
          File.write(turbo_module_file, content)
          Pod::UI.puts "#{turbo_module_file}: applied iOS 26 PAC crash fix"
        end
      end
    end
    # --- End iOS 26 PAC crash fix ---`

      // Inject BEFORE the closing "end" of the post_install block
      // The Podfile structure is:
      //   post_install do |installer|
      //     react_native_post_install(...)
      //   end      <-- inject before this
      // end
      const postInstallEndRegex =
        /(post_install do \|installer\|[\s\S]*?)((\n\s+end\s*\n\s*end))/
      if (postInstallEndRegex.test(contents)) {
        contents = contents.replace(postInstallEndRegex, `$1\n${patchRuby}\n$2`)
      } else {
        console.warn(
          `${PATCH_MARKER} Could not find post_install end block in Podfile`
        )
        return config
      }

      fs.writeFileSync(podfilePath, contents)
      console.log(`${PATCH_MARKER} Injected patch into Podfile post_install`)

      return config
    },
  ])
}

module.exports = withRCTTurboModulePatch
