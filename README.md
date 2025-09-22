# Dutch Learning App: Project Overview

## 1. Project Goal

To create a modern, AI-powered mobile application for learning Dutch vocabulary and phrases using the spaced repetition system (SRS). The app is designed to be a powerful and personalized learning tool, evolving from a core MVP to a feature-rich platform.

## 2. Core Philosophy

- AI-Powered: Leverage Generative AI (initially Gemini) to provide deep word analysis, context, examples, and audio, making the card creation process seamless and intelligent.

- Effective Learning: Built around a proven spaced repetition algorithm (similar to SM-2) to maximize long-term retention.

- Clean & Modern UX: A simple, intuitive, and enjoyable user interface that makes learning feel effortless.

- Scalable Architecture: Built on a modern, robust tech stack with a flexible architecture that allows for easy expansion of features in the future.

## 3. Getting Started

Follow these instructions to get the project running locally for development.

### 1. Clone the repository:

```
git clone <your-repository-url>
cd <repository-name>
```

### 2. Install dependencies:

```
npm install
# or
yarn install
```

### 3. Set up environment variables:

- Copy `env.example` to `.env` and fill in your actual values:

```bash
cp env.example .env
```

- Copy `env.local.example` to `.env.local` for local development overrides (optional):

```bash
cp env.local.example .env.local
```

- Required variables in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_DEV_USER_ID=your_dev_user_id_from_supabase
EXPO_PUBLIC_DEV_USER_EMAIL=dev@test.com
EXPO_PUBLIC_DEV_USER_PASSWORD=password123
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
```

- Optional variables in `.env.local`:

```
SENTRY_AUTH_TOKEN=your_sentry_auth_token_here
```

### 4. Run the application:

```
npm start
# or
yarn start
```

## 4. Key Feature in Detail: AI-Powered Word Addition

The core of the MVP is the intelligent word addition flow. Instead of manual data entry, the user leverages AI for a rich, automated experience.

### User Flow:

1. The user taps the "Add Word" button.

2. They enter a single Dutch word in any form (e.g., "gekocht").

3. The app sends this word to a secure Supabase Edge Function.

4. The function calls the Gemini AI API, requesting a full analysis: lemma (base form), part of speech, translations, and example sentences.

5. The app receives the structured data from the AI and displays it in an editable form.

6. The user can review, make minor edits if needed, and save the word to their collection. A new, comprehensive flashcard is created in seconds.

### New User Experience:

For new users who don&apos;t have any collections yet, the app automatically creates a default collection called &quot;My Dutch Words&quot; when they add their first word. This eliminates the barrier of having to create a collection before being able to add words, making the onboarding experience seamless and intuitive.

## 5. Architecture Diagram

The application uses a modern Backend-as-a-Service (BaaS) architecture, which minimizes the need for a traditional, self-hosted backend.

```
+---------------------+
|                     |
|  React Native App   |
| (Expo)              |
|                     |
+---------------------+
       |      ^
       |      | (User Data, Words)
       |      |
+------v------|-------+      +---------------------+
|                     |      |                     |
|   Supabase Database |      |    Supabase Auth    |
|   (PostgreSQL)      |      |                     |
|                     |      |                     |
+---------------------+      +---------------------+
       ^      |
       |      | (Secure API Call)
       |      |
+------|------v-------+      +---------------------+
|                     |----->|                     |
| Supabase Edge Func. |      |   Gemini AI API     |
| (Holds Secret Key)  |----->| (External Service)  |
|                     |      |                     |
+---------------------+      +---------------------+
```

### Flow Explanation:

- Direct Database/Auth: The app communicates directly with Supabase for standard operations like fetching words or authentication, secured by Row Level Security (RLS).

- Secure AI Calls: To protect the AI API key, the app never calls the AI directly. It calls a trusted Supabase Edge Function, which securely holds the key and forwards the request to the AI service.

## 6. Technology Stack

- **Platform**: React Native with Expo SDK 54 (for iOS, Android, and Web)
- **React**: React 19.1.0 with React Native 0.81.4
- **Architecture**: New Architecture enabled (Reanimated 4.0)
- **Navigation**: expo-router (file-based routing)
- **Backend**: Supabase (PostgreSQL Database, Auth, Edge Functions)
- **AI Integration**: Google Gemini, accessed securely via Supabase Edge Functions
- **Language**: TypeScript
- **State Management**: Zustand
- **Animation**: React Native Reanimated 4.0 + Worklets
- **Gestures**: React Native Gesture Handler 2.28.0
- **Testing**: Jest & React Native Testing Library
- **Code Quality**: ESLint & Prettier
- **Node.js**: Version 20+ required

## 7. Project Status 🎉

✅ **Phase 0 Complete** - Supabase infrastructure fully deployed and tested
✅ **Phase 1 Foundation Complete** - React Native app initialized and running
✅ **Phase 2 Complete** - Backend integration and MVP features
✅ **Phase 3 Complete** - Modern stack upgrade (SDK 54, React 19.1, Reanimated 4.0)
🚀 **Ready for Enhanced Features** - Advanced functionality development

### Current Architecture:

- Database schema with SRS algorithm ✅
- Edge Function for Gemini AI ✅
- TypeScript types and Zustand store ✅
- Expo app running on iOS simulator ✅
- Analysis notes system with HIG compliance ✅

## 8. Documentation

Detailed project documentation is available in the `docs/` folder:

- 📋 [Project Plan](docs/PROJECT_PLAN.md) - Phased development approach
- 📝 [Changelog](CHANGELOG.md) - Release notes and version history
- 🗃️ [Database Schema](docs/DATABASE_SCHEMA.md) - Complete database structure
- 🤖 [AI Strategy](docs/FEATURE_ENRICHMENT_STRATEGY.md) - Gemini integration approach
- 📝 [Task Breakdown](docs/TASK_BREAKDOWN.md) - Detailed development tasks
- ⚙️ [Setup Instructions](docs/SETUP_INSTRUCTIONS.md) - Manual configuration steps
- 📊 [Current Status](docs/CURRENT_STATUS.md) - Real-time project progress
- 🎯 [Project Structure](docs/PROJECT_STRUCTURE.md) - Code organization and best practices
- 🔄 [SRS Algorithm](docs/SRS_ALGORITHM.md) - Spaced repetition system details
- 🎨 [Constants System](docs/CONSTANTS_SYSTEM.md) - Centralized configuration

## 9. Next Steps

The project is ready for MVP feature implementation:

1. **Modify app screens** using Expo Router file-based routing
2. **Implement word addition flow** with AI integration
3. **Create review session UI** with SRS algorithm
4. **Add flashcard animations** and user interactions

Start development by modifying `src/app/(tabs)/index.tsx` for the home screen.
