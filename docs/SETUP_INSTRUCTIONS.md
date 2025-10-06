# Setup Instructions for Dutch Learning App

## ✅ Completed Steps

1. **Database Schema** - Created and applied to Supabase
   - Tables: users, collections, words
   - Row Level Security (RLS) enabled with proper policies
   - Indexes for performance optimization
   - Auto-trigger for user profile creation

2. **Edge Function** - Deployed to Supabase
   - Function name: `gemini-handler`
   - Location: https://supabase.com/dashboard/project/josxavjbcjbcjgulwcyy/functions

## 🔧 Manual Setup Required

### 1. Set up environment variables

#### Option A: Use example files (Recommended)

Copy the example files and fill in your values:

```bash
# Copy main environment file
cp env.example .env

# Copy local overrides (optional)
cp env.local.example .env.local
```

Then edit `.env` with your actual values:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://josxavjbcjbcjgulwcyy.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[GET_FROM_DASHBOARD]

# Development User Credentials
EXPO_PUBLIC_DEV_USER_ID=[CREATE_TEST_USER_FIRST]
EXPO_PUBLIC_DEV_USER_EMAIL=dev@test.com
EXPO_PUBLIC_DEV_USER_PASSWORD=password123

# Sentry Configuration
EXPO_PUBLIC_SENTRY_DSN=[GET_FROM_SENTRY_DASHBOARD]
```

#### Option B: Create .env manually

Create a `.env` file in the project root with the content above.

**Note:** `GEMINI_API_KEY` is set as a Supabase secret, not in .env (see step 4).

### 2. Get Supabase Keys

Visit: https://supabase.com/dashboard/project/josxavjbcjbcjgulwcyy/settings/api

- Copy the `anon` `public` key to `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 3. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create new API key
3. Copy to `GEMINI_API_KEY`

### 4. Set Gemini API Key as Supabase Secret

Run this command with your actual Gemini API key:

```bash
npx supabase secrets set GEMINI_API_KEY=your_actual_gemini_key_here
```

### 5. Create Test User

1. Go to: https://supabase.com/dashboard/project/josxavjbcjbcjgulwcyy/auth/users
2. Click "Add user"
3. Create user with email: `dev@test.com` and password: `password123`
4. Copy the User ID (UUID) to `EXPO_PUBLIC_DEV_USER_ID` in .env

### 6. Test Edge Function

After setting up the API key, test the function:

```bash
curl -X POST \
  https://josxavjbcjbcjgulwcyy.supabase.co/functions/v1/gemini-handler \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"word": "kopen"}'
```

### 7. Configure Apple Sign-In (iOS only)

Apple Sign-In is automatically configured through Expo. Required setup:

1. **Add Apple Sign-In Capability in Xcode** (for development builds):
   - Open your project in Xcode
   - Select your target → Signing & Capabilities
   - Click "+ Capability" → Sign in with Apple

2. **Configure in Apple Developer Portal** (for production):
   - Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list)
   - Select your app identifier
   - Enable "Sign In with Apple" capability
   - Save changes

3. **Supabase Apple Provider Configuration**:
   - Go to [Supabase Auth Providers](https://supabase.com/dashboard/project/josxavjbcjbcjgulwcyy/auth/providers)
   - Enable Apple provider
   - Add your iOS Bundle ID: `com.oldrefery.dutch-learning-app`
   - Add Services ID (if using web)

**Note**: Apple Sign-In is enabled in `app.json` with:

```json
{
  "ios": {
    "usesAppleSignIn": true
  },
  "plugins": ["expo-apple-authentication"]
}
```

## 🎯 Next Steps

After completing the manual setup:

1. Initialize React Native/Expo project
2. Install dependencies (Supabase, Zustand, etc.)
3. Create basic app structure
4. Implement word addition flow
5. Implement SRS review system

## 📁 Project Structure Created

```
supabase/
├── migrations/
│   └── 001_initial_schema.sql    ✅ Applied
└── functions/
    └── gemini-handler/
        └── index.ts               ✅ Deployed
```
