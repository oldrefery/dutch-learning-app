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

### 4. Setup Sentry Configuration (Required for Local Production Builds):

For proper source map uploads to Sentry during local production builds, create a `.sentryclirc` file in the project root:

```
[auth]
token=your_sentry_auth_token_here
```

This file is required for the local build script to properly upload source maps to Sentry for crash reporting. Note: EAS builds in the cloud handle Sentry configuration automatically through environment variables.

### 5. Run the application:

```
npm start
# or
yarn start
```

## 4. Key Features

### 🚀 Smart Word Analysis Cache

Revolutionary caching system that delivers **80-90% cost reduction** and **instant responses** for word analysis:

- **Intelligent Sharing**: Cross-user cache sharing means popular words are analyzed once and shared globally
- **Lightning Fast**: <100ms response time for cached words vs 3-5s for fresh analysis
- **Cost Effective**: Dramatic reduction in API costs through smart caching strategy
- **Apple HIG UI**: Native iOS-style cache indicators with refresh controls
- **Force Refresh**: Manual override option when fresh analysis is needed

### 🤖 AI-Powered Word Addition

The core of the app is the intelligent word addition flow. Instead of manual data entry, the user leverages AI for a rich, automated experience.

#### User Flow:

1. The user taps the "Add Word" button.

2. They enter a single Dutch word in any form (e.g., "gekocht").

3. The app checks the **smart cache first** for instant results.

4. If not cached, the app sends the word to a secure Supabase Edge Function.

5. The function calls the Gemini AI API, requesting a full analysis: lemma (base form), part of speech, translations, and example sentences.

6. The app receives the structured data from the AI and displays it with **cache status indicators**.

7. The user can review, make minor edits if needed, and save the word to their collection. A new, comprehensive flashcard is created in seconds.

#### Cache UI Features:

- **Status Badge**: Shows "📁 Cache" for cached results or "🤖 AI" for fresh analysis
- **Smart Refresh Button**: Appears only for cached results, allowing force refresh when needed
- **Usage Statistics**: Toast messages show how many times a word has been cached
- **Timestamp Display**: Subtle indication of when data was cached

### 📤 Collection Sharing System

Complete collection sharing functionality that allows users to share their word collections with others:

- **In-App Collection Import**: Import collections directly in the app using collection codes (no deeplinks required)
- **Secure Sharing**: UUID-based share tokens with proper access controls and RLS policies
- **Native Sharing UX**: Long press collections for context menus with copy/share/stop sharing options
- **Enhanced Import Flow**: Streamlined import experience with duplicate detection and word selection

#### Import Screen Features:

- **Duplicate Word Filter**: Toggle to hide/show already added words (hidden by default for cleaner UX)
- **Collection Name Display**: Shows actual collection names instead of technical IDs
- **Smart Word Selection**: Automatic detection and marking of duplicate words with collection source
- **Batch Import**: Select multiple words for efficient batch importing to target collections

### 🔐 Password Reset Flow

Complete password recovery system with secure token-based authentication:

- **Forgot Password**: Email-based password reset request from login screen
- **Email Deep Links**: Automatic navigation from password reset emails to the app
- **Secure Token Exchange**: Atomic session setup with password update using Supabase tokens
- **Form Validation**: Client-side password strength and match verification
- **HIG-Compliant Navigation**: Multiple ways to navigate (header back button, swipe gesture, text link)
- **Clear User Feedback**: Success/error messaging with auto-redirect to login after successful reset

#### Security Features:

- **Token-Based Authentication**: Secure access tokens from Supabase Auth
- **Non-Blocking Auth State**: Optimized session management prevents UI freezing
- **Comprehensive Error Handling**: Sentry logging for all password reset operations
- **Deep Link Parsing**: Robust URL parsing with hash fragment to query params conversion

### 🔍 Collection Search

Fast and intuitive search functionality within collections:

- **Real-time Search**: Instant search with 300ms debounce for optimal performance
- **Dutch Word Focus**: Search specifically by Dutch lemma for precise results
- **Substring Matching**: Find words by typing any part of the word (beginning, middle, or end)
- **Smart Result Counter**: Shows "X of Y words" to indicate search results
- **HIG-Compliant Design**: 44px touch targets and platform-specific clear buttons
- **Theme Support**: Full dark/light mode with proper contrast and accessibility
- **Empty State Handling**: Different messages for "no search results" vs "no words in collection"

#### Search Features:

- **Debounced Input**: Prevents excessive filtering while maintaining responsive feedback
- **Local State Management**: Text appears instantly while search is optimized in the background
- **Platform-Specific UX**: Native iOS clear button, custom Android implementation
- **Accessibility**: Proper focus states, semantic colors, and touch target sizes

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
- Smart word analysis cache with 80-90% cost reduction ✅
- Apple HIG cache UI with status indicators ✅

## Recent Updates (Build 33)

### 🐛 Bug Fixes

- **Word Highlighting Animation**: Removed distracting flashing/blinking animations for duplicate words
  - Eliminated red highlight overlay animations that appeared when scrolling to duplicate words
  - Preserved smooth scroll-to-word functionality for better navigation experience
  - Improved overall user experience by removing visual distractions

### 🛠️ Architecture Improvements

- **CollectionContent Component**: Refactored for improved rendering performance
  - Extracted keyExtractor and renderItem functions for better optimization
  - Improved code organization and prop handling

- **SwipeableWordItem Component**: Streamlined highlighting system
  - Replaced complex highlight animation with simple border indication
  - Simplified component interface and reduced memory usage
  - Maintained all word interaction features (swipe gestures, selection, etc.)

### ⚡ Performance Optimizations

- **Animation System**: Removed unnecessary highlight animations
  - Reduced component complexity and memory usage
  - Simplified animated style calculations
  - Improved overall app responsiveness

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

## 10. Production Build

The project includes an automated build script for creating **local** production builds:

```bash
# Build and submit for both platforms
./scripts/build-and-submit.sh

# Build for specific platform only
./scripts/build-and-submit.sh --platform ios
./scripts/build-and-submit.sh --platform android

# Build only (don't submit to stores)
./scripts/build-and-submit.sh --build-only
```

**Requirements for Local Builds:**

- `.sentryclirc` file must be present in the project root with valid Sentry auth token
- EAS CLI must be configured with proper credentials
- Apple ID and Google Play credentials must be set up in EAS

The script automatically:

- Increments build numbers for both platforms
- Builds locally for faster performance
- Uploads source maps to Sentry for crash reporting
- Submits to App Store Connect and Google Play Store

**Note:** This configuration is only needed for local builds. EAS cloud builds handle Sentry configuration automatically through environment variables and don't require the `.sentryclirc` file.
