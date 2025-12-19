# Next Steps to Fix GitHub Actions E2E Tests

## What Was Fixed ✅

1. **Removed hardcoded credentials** from `.maestro/config.yaml` and `.maestro/.maestro.env`
2. **Updated .gitignore** to prevent committing credentials
3. **Fixed GitHub Actions workflow** with proper build and test flow
4. **Added debug logging** for troubleshooting
5. **Created documentation** for GitHub secrets setup

## Required: Configure GitHub Secrets

Before pushing, you **must** configure these secrets in GitHub:

### Step 1: Get EXPO_TOKEN

```bash
# Login to Expo
npx eas login

# Go to: https://expo.dev/accounts/[your-account]/settings/access-tokens
# Click "Create Token"
# Copy the token
```

### Step 2: Add Secrets to GitHub

1. Go to: `https://github.com/[your-username]/DutchLearningApp/settings/secrets/actions`
2. Click **New repository secret**
3. Add these three secrets:

| Name                    | Value                        | Where to get it         |
| ----------------------- | ---------------------------- | ----------------------- |
| `EXPO_TOKEN`            | Your Expo access token       | From Step 1             |
| `MAESTRO_TEST_EMAIL`    | `test.dutch.a.p.p@gmail.com` | Your test user email    |
| `MAESTRO_TEST_PASSWORD` | `TestPass123!`               | Your test user password |

### Step 3: Verify Test User Exists

Make sure the test user exists in your Supabase database:

1. Go to your Supabase project
2. **Authentication → Users**
3. Verify user with email `test.dutch.a.p.p@gmail.com` exists
4. If not, create it with the same credentials

## Push Changes

Once secrets are configured:

```bash
# Push to origin
git push origin feature/e2e-tests-maestro

# Create Pull Request on GitHub
# The E2E tests will now run with proper credentials
```

## What to Expect

After pushing, GitHub Actions will:

1. ✅ Build Android APK using EAS (~10-15 minutes)
2. ✅ Start Android emulator
3. ✅ Install APK and run Maestro tests
4. ✅ Upload test results
5. ✅ Comment on PR with results

## Troubleshooting

If tests still fail, check:

1. **Secrets are set correctly** in GitHub repository settings
2. **Test user exists** in Supabase with correct credentials
3. **EXPO_TOKEN is valid** - run `npx eas whoami` to verify
4. **View workflow logs** in GitHub Actions tab for detailed errors

## Documentation

- 📖 Full secrets setup guide: [docs/GITHUB_SECRETS.md](docs/GITHUB_SECRETS.md)
- 📖 E2E testing guide: [docs/E2E_TESTING.md](docs/E2E_TESTING.md)
- 📖 Maestro local testing: [.maestro/README.md](.maestro/README.md)

---

**Ready to push?** Make sure secrets are configured first! 🚀
