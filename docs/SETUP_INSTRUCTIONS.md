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

### 1. Create .env file
Create a `.env` file in the project root with the following content:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://josxavjbcjbcjgulwcyy.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[GET_FROM_DASHBOARD]

# Development User ID (will be replaced with actual auth later)
DEV_USER_ID=[CREATE_TEST_USER_FIRST]

# Gemini AI API Key (for Edge Functions)
GEMINI_API_KEY=[GET_FROM_GOOGLE_AI_STUDIO]
```

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
4. Copy the User ID (UUID) to `DEV_USER_ID` in .env

### 6. Test Edge Function
After setting up the API key, test the function:
```bash
curl -X POST \
  https://josxavjbcjbcjgulwcyy.supabase.co/functions/v1/gemini-handler \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"word": "kopen"}'
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
