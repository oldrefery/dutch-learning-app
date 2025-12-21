# E2E Tests with Maestro

This directory contains end-to-end test flows for the Dutch Learning App using Maestro.

## Overview

Maestro is a modern UI testing framework that uses YAML-based test definitions. Tests are interpreted and run directly on the device/emulator without requiring compilation.

## Prerequisites

1. **Maestro CLI** installed globally:

   ```bash
   curl -Ls "https://get.maestro.sh" | bash
   ```

2. **iOS Simulator** or **Android Emulator** running

3. **App built** for testing

## Running Tests

### Prerequisites

Before running tests, ensure:

1. The app is **built and running** in an emulator/simulator:

   ```bash
   npm run ios  # for iOS
   npm run android  # for Android
   ```

2. Environment variables are configured in `.env`:
   - `EXPO_PUBLIC_DEV_USER_EMAIL` - Test user email
   - `EXPO_PUBLIC_DEV_USER_PASSWORD` - Test user password

   These are automatically loaded from `.env` when running `npm run e2e:test` commands.

### Run a single test

```bash
npm run e2e:test
```

This runs the smoke test (login flow) against the app.

### Run all tests

```bash
npm run e2e:test:all
```

Runs all test flows in the `.maestro/` directory in alphabetical order.

### Record a new test

```bash
npm run e2e:record
```

Opens Maestro recording mode to create new tests interactively. Great for discovering correct selectors.

### Manual test with Maestro CLI

```bash
maestro test .maestro/01-auth-login.yaml
maestro test .maestro/ --verbose  # Run all with verbose output
```

## Test Flows

### 01-auth-login.yaml

Tests the login flow with dev user credentials loaded from environment variables.

**What it tests:**

- App launches
- Login screen is visible
- User can enter email (from `MAESTRO_TEST_EMAIL` env var)
- User can enter password (from `MAESTRO_TEST_PASSWORD` env var)
- User can tap sign in button

**Credentials:**

- Loaded from `EXPO_PUBLIC_DEV_USER_EMAIL` and `EXPO_PUBLIC_DEV_USER_PASSWORD` in `.env`
- Passed to test as `${MAESTRO_TEST_EMAIL}` and `${MAESTRO_TEST_PASSWORD}`
- Never hardcoded in test files for security

### 02-auth-signup.yaml

Tests the signup flow.

**What it tests:**

- App launches
- User navigates to signup screen
- User can enter email
- User can enter password and confirm password
- User can submit signup form

### 03-app-navigation.yaml

Tests navigation between app tabs.

**What it tests:**

- App launches
- User can navigate to Review tab
- User can navigate to Add Word tab
- User can navigate to History tab
- User can navigate to Settings tab
- User can return to Home tab

## Writing New Tests

### Test Syntax

```yaml
appId: com.oldrefery.dutchlearningapp
---
# Action: Launch the app
- launchApp

# Action: Wait for animations to finish
- waitForAnimationToFinish

# Action: Assert text is visible
- assertVisible:
    text: 'Expected Text'

# Action: Tap on element by testID
- tapOn:
    id: 'test-id'

# Action: Tap on element by text
- tapOn:
    text: 'Button Text'

# Action: Input text to focused input
- inputText: 'Some text'

# Action: Simple scroll (no parameters supported)
- scroll

# Action: Take screenshot
- takeScreenshot: screenshot.png
```

### Best Practices

1. **Use testID for critical elements** - Makes tests more reliable
2. **Add wait commands** - Use `waitForAnimationToFinish` after navigation
3. **One test per flow** - Keep tests focused on a single user journey
4. **Use clear naming** - Prefix with numbers (01-, 02-) for execution order
5. **Add comments** - Explain what each test section does

### Test Credentials (Security)

Tests load credentials from environment variables to keep sensitive data out of git:

```bash
# Environment variables used by tests:
# MAESTRO_TEST_EMAIL - passed from EXPO_PUBLIC_DEV_USER_EMAIL (.env)
# MAESTRO_TEST_PASSWORD - passed from EXPO_PUBLIC_DEV_USER_PASSWORD (.env)
```

**Important:** Never hardcode credentials in test files. The npm scripts automatically:

1. Read `EXPO_PUBLIC_DEV_USER_EMAIL` and `EXPO_PUBLIC_DEV_USER_PASSWORD` from `.env`
2. Pass them as `MAESTRO_TEST_EMAIL` and `MAESTRO_TEST_PASSWORD` environment variables
3. Maestro test files reference them as `${MAESTRO_TEST_EMAIL}` and `${MAESTRO_TEST_PASSWORD}`

**To use custom credentials:**

```bash
# Option 1: Update .env file (tracked locally, not in git)
EXPO_PUBLIC_DEV_USER_EMAIL=test@example.com
EXPO_PUBLIC_DEV_USER_PASSWORD=password123

# Option 2: Pass via command line (for CI/CD)
MAESTRO_TEST_EMAIL=test@example.com MAESTRO_TEST_PASSWORD=password123 npm run e2e:test:all
```

## Adding testID to Components

To make elements testable, add `testID` prop to React Native components:

```jsx
<TouchableOpacity testID="sign-in-button">
  <Text>Sign In</Text>
</TouchableOpacity>

<TextInput testID="email-input" />
```

**Important:** All `testID` props should use kebab-case naming convention.

## CI/CD Integration

E2E tests automatically run in GitHub Actions on push/PR to `main` or `develop` branches.

### GitHub Actions Workflow

The workflow (`.github/workflows/e2e-tests.yml`) performs:

1. Builds Android APK using EAS
2. Starts Android emulator
3. Installs APK on emulator
4. Runs all Maestro tests
5. Uploads test results as artifacts
6. Comments on PR with results

### Required GitHub Secrets

Before tests can run in CI, configure these secrets in repository settings:

1. **EXPO_TOKEN** - Expo access token for EAS builds
2. **MAESTRO_TEST_EMAIL** - Test user email
3. **MAESTRO_TEST_PASSWORD** - Test user password

See [docs/GITHUB_SECRETS.md](../docs/GITHUB_SECRETS.md) for detailed setup instructions.

### Local Configuration

For local testing, copy example files and configure with your credentials:

```bash
# Copy example files
cp .maestro/.maestro.env.example .maestro/.maestro.env
cp .maestro/config.yaml.example .maestro/config.yaml

# Edit with your test credentials
# These files are .gitignored and won't be committed
```

## Troubleshooting

### "App not found" error

- Make sure the app is built and installed on the simulator/emulator
- Check that `appId` matches the app's bundle ID

### "Element not found" error

- Ensure the element has a `testID` prop
- Use Maestro Studio to inspect the app and find the correct selector
- Check that `waitForAnimationToFinish` is called before asserting visibility

### Flaky tests

- Add more `waitForAnimationToFinish` calls
- Use `assertVisible` instead of `tapOn` to wait for elements
- Increase wait times if needed

## Resources

- [Maestro Documentation](https://docs.maestro.dev)
- [Expo Testing Guide](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- [React Native Testing](https://reactnative.dev/docs/testing-overview)
