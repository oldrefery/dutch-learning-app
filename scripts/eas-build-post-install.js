#!/usr/bin/env node

// EAS Build post-install hook: patches RCTTurboModule.mm for iOS 26 PAC crash
// Runs after pod install, before Xcode compilation
// See: https://github.com/facebook/react-native/pull/56265

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const TAG = '[eas-build-post-install]'
const BAD_LINE =
  'throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);'
const PATCHED_LINE = '@throw exception; // patched: react-native#56265'

// Only patch on iOS (macOS build agents)
if (process.platform !== 'darwin') {
  console.log(`${TAG} Not macOS, skipping iOS patch`)
  process.exit(0)
}

const projectRoot = path.resolve(path.dirname(process.argv[1]), '..')
const iosDir = path.join(projectRoot, 'ios')

if (!fs.existsSync(iosDir)) {
  console.log(`${TAG} No ios/ directory found, skipping`)
  process.exit(0)
}

// Search for RCTTurboModule.mm in Pods directory
let filesToPatch = []

try {
  const result = execSync(
    `find "${path.join(iosDir, 'Pods')}" -name "RCTTurboModule.mm" -type f 2>/dev/null`,
    { encoding: 'utf8' }
  ).trim()
  filesToPatch = result.split('\n').filter(Boolean)
} catch {
  // find returns non-zero if no matches
}

// Also check node_modules path (for buildReactNativeFromSource)
const nodeModulesPath = path.join(
  projectRoot,
  'node_modules',
  'react-native',
  'ReactCommon',
  'react',
  'nativemodule',
  'core',
  'platform',
  'ios',
  'ReactCommon',
  'RCTTurboModule.mm'
)

if (fs.existsSync(nodeModulesPath) && !filesToPatch.includes(nodeModulesPath)) {
  filesToPatch.push(nodeModulesPath)
}

if (filesToPatch.length === 0) {
  console.log(`${TAG} RCTTurboModule.mm not found in Pods or node_modules`)
  process.exit(0)
}

let patchedCount = 0

for (const filePath of filesToPatch) {
  let content = fs.readFileSync(filePath, 'utf8')

  if (!content.includes(BAD_LINE)) {
    if (content.includes(PATCHED_LINE)) {
      console.log(`${TAG} Already patched: ${filePath}`)
    } else {
      console.log(`${TAG} Target line not found in: ${filePath}`)
    }
    continue
  }

  // Replace the LAST occurrence (inside performVoidMethodInvocation)
  const lastIdx = content.lastIndexOf(BAD_LINE)
  content =
    content.substring(0, lastIdx) +
    PATCHED_LINE +
    content.substring(lastIdx + BAD_LINE.length)

  fs.writeFileSync(filePath, content)
  console.log(`${TAG} Patched: ${filePath}`)
  patchedCount++
}

console.log(
  `${TAG} Done. Patched ${patchedCount}/${filesToPatch.length} file(s).`
)
