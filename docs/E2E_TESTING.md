# E2E Testing Guide for Dutch Learning App

This guide covers end-to-end testing using Maestro for the Dutch Learning App.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Running Tests Locally](#running-tests-locally)
4. [Writing New Tests](#writing-new-tests)
5. [CI/CD Integration](#cicd-integration)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Overview

Maestro is a modern E2E testing framework that enables writing tests in YAML without compilation. This approach provides:

- **Fast iteration** - YAML-based tests run without compilation
- **Flakiness tolerance** - Built-in handling for UI element variability
- **Cross-platform** - Single test suite for iOS and Android
- **Developer-friendly** - Simple syntax that's easy to understand and maintain

### What We're Testing

- **Authentication flows** - Login, signup, password reset
- **App navigation** - Tab switching, screen transitions
- **Core features** - Word addition, review process
- **User interactions** - Form submissions, button taps, text input

## Prerequisites

### Installation

1. **Install Maestro CLI:**

   ```bash
   curl -Ls "https://get.maestro.sh" | bash
   ```

2. **Verify installation:**

   ```bash
   maestro --version
   ```

3. **Ensure Node.js dependencies are installed:**
   ```bash
   npm install
   ```

### System Requirements

- Node.js 18+
- iOS Simulator (for macOS) or Android Emulator
- Xcode Command Line Tools (for iOS)
- Android SDK (for Android)

## Running Tests Locally

### Quick Start

1. **Start your development environment:**

   For iOS:

   ```bash
   npm run ios
   ```

   For Android:

   ```bash
   npm run android
   ```

   Wait for the app to fully load in the emulator.

2. **Run the smoke test:**

   ```bash
   npm run e2e:test
   ```

   This runs the basic login flow test.

3. **Run all tests:**

   ```bash
   npm run e2e:test:all
   ```

   This runs all test files in `.maestro/` directory in alphabetical order.

### Available Commands

```bash
# Run smoke test (basic login flow)
npm run e2e:test

# Run all e2e tests
npm run e2e:test:all

# Record a new test interactively
npm run e2e:record

# Run specific test with Maestro CLI
maestro test .maestro/01-auth-login.yaml

# Run test with verbose output
maestro test .maestro/01-auth-login.yaml --verbose
```

### Expected Output

When a test passes:

```
✅ Maestro finished successfully.

Tests passed: 3/3
```

When a test fails:

```
❌ Maestro finished with errors.

Failed step: tapOn
  id: "non-existent-element"
  Line: 15

Error: Could not find element
```

## Writing New Tests

### Test File Structure

Create a new YAML file in `.maestro/` directory. Use numerical prefix for ordering:

```yaml
appId: com.oldrefery.dutchlearningapp
---
# Test description
- launchApp
- waitForAnimationToEnd
- assertVisible:
    text: 'Expected Text'
```

### Common Commands

#### Launch App

```yaml
- launchApp
```

Launches the app on the connected device/emulator.

#### Wait for Animations

```yaml
- waitForAnimationToEnd
```

Waits for all animations to complete. Use this before assertions after navigation.

#### Assert Visibility

```yaml
- assertVisible:
    text: 'Button Text'
- assertVisible:
    id: 'element-id'
```

Verifies that an element is visible. Automatically waits for the element.

#### Tap Elements

```yaml
# Tap by testID
- tapOn:
    id: 'sign-in-button'

# Tap by text
- tapOn:
    text: 'Sign In'

# Tap coordinates
- tapOn:
    point:
      x: 200
      y: 400
```

#### Input Text

```yaml
- tapOn:
    id: 'email-input'
- inputText: 'user@example.com'
```

#### Scroll

```yaml
- scroll:
    direction: down
    amount: 3
```

#### Take Screenshots

```yaml
- takeScreenshot: my-screenshot.png
```

#### Repeat Actions

```yaml
- repeat:
    times: 5
    commands:
      - scroll:
          direction: down
          amount: 1
```

#### Conditionals

```yaml
- if:
    condition:
      - assertVisible:
          text: 'Modal'
    then:
      - tapOn:
          text: 'Close'
```

### Example: Complete Test Flow

```yaml
appId: com.oldrefery.dutchlearningapp
---
# Test: Adding a new word to a collection
- launchApp
- waitForAnimationToEnd
- assertVisible:
    text: 'Collections'
- tapOn:
    text: 'Add Word'
- waitForAnimationToEnd
- assertVisible:
    text: 'Add New Word'
- tapOn:
    id: 'word-input'
- inputText: 'goedemorgen'
- tapOn:
    id: 'translation-input'
- inputText: 'good morning'
- tapOn:
    id: 'submit-word-button'
- waitForAnimationToEnd
- assertVisible:
    text: 'Word added successfully'
```

## Adding testID to Components

For Maestro to find elements, they need `testID` props in React Native components.

### Example

```jsx
import { TextInput, TouchableOpacity } from 'react-native'

export function LoginForm() {
  return (
    <>
      <TextInput testID="email-input" placeholder="Email" />
      <TouchableOpacity testID="sign-in-button">
        <Text>Sign In</Text>
      </TouchableOpacity>
    </>
  )
}
```

### Finding Correct Selectors

1. **Use Maestro Studio (Beta):**
   - Download from https://maestro.mobile
   - Visual inspector helps identify elements
   - Export tests to YAML

2. **Use console debugging:**

   ```bash
   maestro test .maestro/test.yaml --verbose
   ```

3. **Check component source code:**
   - Search for `testID` in components
   - Add missing testIDs where needed

## Security: Managing Test Credentials

Maestro test files use environment variables to keep sensitive credentials out of version control:

### How It Works

1. **Environment variables are defined in `.maestro/.maestro.env` or `.env`** (not tracked in git):

   ```
   MAESTRO_TEST_EMAIL=test@example.com
   MAESTRO_TEST_PASSWORD=testpassword123
   ```

   If `MAESTRO_TEST_*` are missing, the npm scripts fall back to
   `EXPO_PUBLIC_DEV_USER_EMAIL` and `EXPO_PUBLIC_DEV_USER_PASSWORD` from `.env`.

2. **npm scripts pass them to Maestro tests**:

   ```bash
   # From package.json:
   "e2e:test": "MAESTRO_TEST_EMAIL=$EXPO_PUBLIC_DEV_USER_EMAIL ... maestro test ..."
   ```

3. **Test files reference them as variables**:
   ```yaml
   - inputText: ${MAESTRO_TEST_EMAIL}
   ```

### For CI/CD

In GitHub Actions or other CI systems:

1. Add repository secrets (never commit credentials):
   - `MAESTRO_TEST_EMAIL` - Test user email
   - `MAESTRO_TEST_PASSWORD` - Test user password

2. Pass them to the workflow:

   ```yaml
   env:
     MAESTRO_TEST_EMAIL: ${{ secrets.MAESTRO_TEST_EMAIL }}
     MAESTRO_TEST_PASSWORD: ${{ secrets.MAESTRO_TEST_PASSWORD }}
   ```

3. Run tests with credentials:
   ```bash
   MAESTRO_TEST_EMAIL=${{ secrets.MAESTRO_TEST_EMAIL }} \
   MAESTRO_TEST_PASSWORD=${{ secrets.MAESTRO_TEST_PASSWORD }} \
   maestro test .maestro/
   ```

## CI/CD Integration

### GitHub Actions Workflow

The project includes automated E2E testing in CI/CD:

**File:** `.github/workflows/e2e-tests.yml`

**When it runs:**

- On push to `main` or `develop` branches
- On pull requests to `main` or `develop` branches

**What it does:**

1. Builds the app using EAS for testing profile
2. Sets up Android emulator
3. Installs Maestro
4. Runs all E2E tests with credentials from secrets
5. Uploads test artifacts
6. Comments on PRs with results

### Required GitHub Secrets

Add these to GitHub repository secrets (Settings → Secrets):

```
EXPO_TOKEN = <your-expo-token>
MAESTRO_TEST_EMAIL = <test-user-email>
MAESTRO_TEST_PASSWORD = <test-user-password>
```

Get your Expo token:

```bash
eas login
eas whoami
```

### Running Tests in CI

Tests will automatically run when you push to the main branches. Monitor results:

1. Go to **Actions** tab in GitHub
2. Click the **E2E Tests** workflow
3. View test results in the logs
4. Download artifacts if needed

## Troubleshooting

### "App not found" Error

**Problem:**

```
Error: App is not installed on the device
```

**Solution:**

1. Verify app is built and running in emulator:
   ```bash
   npm run ios  # or npm run android
   ```
2. Check bundle ID matches in test file:
   ```yaml
   appId: com.oldrefery.dutchlearningapp
   ```
3. Try reinstalling the app:
   ```bash
   npm run ios -- --clean  # iOS
   npm run android -- --clean  # Android
   ```

### "Element not found" Error

**Problem:**

```
Error: Could not find element with id: "email-input"
```

**Solution:**

1. Verify the element has `testID` prop:
   ```jsx
   <TextInput testID="email-input" />
   ```
2. Check component file was updated (look for recent git changes)
3. Rebuild the app:
   ```bash
   npm run ios  # Rebuilds the entire app
   ```
4. Use text-based selector if testID doesn't work:
   ```yaml
   - tapOn:
       text: 'Email'
   ```

### Tests Run Slowly

**Problem:**

- Tests take too long to complete

**Solution:**

1. Reduce waits:
   ```yaml
   # Replace long waits with specific assertions
   - assertVisible:
       text: 'Button' # Waits automatically
   ```
2. Use `waitForAnimationToEnd` strategically, not excessively
3. Optimize test order to avoid app restarts
4. Run on faster hardware or cloud devices

### Flaky Tests

**Problem:**

- Tests sometimes pass, sometimes fail

**Solution:**

1. Add `waitForAnimationToEnd` after navigation
2. Use assertions to wait for UI state:
   ```yaml
   - assertVisible:
       text: 'Loaded Data' # Waits up to 10s by default
   ```
3. Avoid tight timing dependencies
4. Use testID instead of text for reliability

### Permission Errors on macOS

**Problem:**

```
Permission denied
```

**Solution:**

```bash
# Fix Maestro permissions
chmod +x $HOME/.maestro/bin/maestro
```

## Best Practices

### 1. Naming Conventions

- **Test files:** Use numbered prefix (01-, 02-, 03-)
- **Test IDs:** Use kebab-case (sign-in-button, email-input)
- **Files:** Describe what is tested (01-auth-login.yaml)

### 2. Test Organization

```
.maestro/
├── 01-auth-login.yaml        # Auth flows
├── 02-auth-signup.yaml
├── 03-app-navigation.yaml    # Core features
├── 04-review-flow.yaml
├── config.yaml               # Shared configuration
└── README.md                 # Documentation
```

### 3. Test Isolation

- Each test should be independent
- Don't rely on previous test state
- Use `launchApp` to start fresh
- Clean up after tests if needed

### 4. Maintainability

- Keep tests simple and focused
- Comment complex flows
- Use meaningful testIDs
- Update testIDs when renaming components

### 5. Performance

- Run essential tests in CI/CD
- Use smoke tests for quick feedback
- Keep test suites focused
- Parallel execution with multiple devices

### 6. Code Review

- Review test changes like code changes
- Ensure testIDs follow conventions
- Check for flakiness patterns
- Request Maestro tests for UI changes

## Resources

- [Maestro Documentation](https://docs.maestro.dev)
- [React Native Testing](https://reactnative.dev/docs/testing-overview)
- [Expo Testing Guide](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- [GitHub Actions Workflows](https://docs.github.com/en/actions/using-workflows)

## Getting Help

If you encounter issues:

1. Check this guide's **Troubleshooting** section
2. Review `.maestro/README.md` for quick reference
3. Check Maestro logs: `maestro test .maestro/ --verbose`
4. Ask in team Slack or create an issue

---

**Last Updated:** 2025-10-27
**Maestro Version:** 2.0.3+
