# GitHub Secrets Configuration

This document describes the required GitHub secrets for CI/CD workflows.

## Required Secrets

### 1. EXPO_TOKEN

**Purpose:** Authentication for EAS CLI to build the app in GitHub Actions.

**How to get it:**

```bash
# Login to your Expo account
npx eas login

# Generate a token
npx eas whoami
# Or create a new token in: https://expo.dev/accounts/[your-account]/settings/access-tokens
```

**How to add:**

1. Go to repository **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `EXPO_TOKEN`
4. Value: Your Expo access token
5. Click **Add secret**

### 2. MAESTRO_TEST_EMAIL

**Purpose:** Test user email for E2E authentication tests.

**Value:** Email of the test user in your Supabase database.

**Example:** `test.dutch.app@gmail.com`

**How to add:**

1. Go to repository **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `MAESTRO_TEST_EMAIL`
4. Value: Your test user email
5. Click **Add secret**

### 3. MAESTRO_TEST_PASSWORD

**Purpose:** Test user password for E2E authentication tests.

**Value:** Password of the test user in your Supabase database.

**Example:** `TestPass123!`

**Security Note:** This should be a dedicated test account, not a real user account.

**How to add:**

1. Go to repository **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `MAESTRO_TEST_PASSWORD`
4. Value: Your test user password
5. Click **Add secret**

## Setting Up Test User

Before running E2E tests, create a test user in Supabase:

1. Go to your Supabase project
2. Navigate to **Authentication → Users**
3. Click **Add user**
4. Email: Same as `MAESTRO_TEST_EMAIL`
5. Password: Same as `MAESTRO_TEST_PASSWORD`
6. Confirm email (if required)

## Verifying Setup

After adding secrets, you can verify they work by:

1. Push a commit to trigger the workflow
2. Go to **Actions** tab in GitHub
3. Watch the workflow run
4. Check logs for authentication success

## Security Best Practices

- ✅ **Never commit secrets to git**
- ✅ Use dedicated test accounts
- ✅ Rotate tokens periodically
- ✅ Limit token permissions to what's needed
- ❌ Don't use production user credentials
- ❌ Don't share tokens in chat/email

## Troubleshooting

### "Authentication failed" error

- Verify `EXPO_TOKEN` is valid: `npx eas whoami`
- Check token hasn't expired
- Ensure token has build permissions

### "Login failed" in E2E tests

- Verify test user exists in Supabase
- Check email/password match exactly
- Confirm user email is verified (if required)

### Secrets not found

- Check secret names match exactly (case-sensitive)
- Ensure secrets are set at repository level, not organization
- Try re-adding the secret

## Reference

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Maestro Documentation](https://maestro.mobile.dev/)
