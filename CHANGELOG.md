# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2025-10-06 (Build 45)

### Added

- **Apple Sign-In Authentication**: Native Apple Sign-In integration for iOS devices
  - **Native iOS Support**: Built using expo-apple-authentication for seamless iOS integration
  - **Secure Nonce Generation**: Cryptographically secure random nonce with SHA-256 hashing
  - **Privacy-First Design**: Supports Apple's privacy features including email relay and name sharing
  - **Identity Token Validation**: Secure authentication through Supabase Auth integration
  - **Availability Checking**: Runtime verification of Apple Sign-In availability on device
  - **Platform-Specific Rendering**: Automatically hidden on non-iOS platforms
  - **HIG-Compliant Button**: Native Apple Sign In button following Apple design guidelines
    - Adaptive dark/light theme support with proper contrast
    - Loading states with activity indicator
    - Disabled state handling with proper opacity
    - Apple icon using @expo/vector-icons (AntDesign)
  - **Seamless Integration**: Added to both login and signup screens alongside Google OAuth
  - **Auto-Navigation**: Automatic redirect to main app after successful authentication

### Security

- **Replay Attack Prevention**: Nonce-based security system
  - Generates 32-byte cryptographically secure random nonce using expo-crypto
  - Hashes nonce with SHA-256 before sending to Apple
  - Validates identity token with original nonce through Supabase
- **Comprehensive Error Handling**:
  - Graceful handling of user-cancelled authentication attempts
  - Sentry logging for all authentication errors with detailed context
  - User-friendly error messages for common failure scenarios
  - Proper error categorization (availability, cancellation, authentication)

### Technical

- **New Components**:
  - `src/components/auth/AppleSignInButton.tsx` - Apple authentication button component
    - Platform-specific rendering (iOS only)
    - Theme-aware styling with adaptive colors
    - Loading and disabled state management
  - `src/lib/appleAuth.ts` - Apple Sign-In authentication helpers
    - `generateNonce()` - Secure random nonce generation
    - `hashNonce()` - SHA-256 nonce hashing
    - `isAppleAuthAvailable()` - Platform and availability checking
    - `initiateAppleSignIn()` - Complete authentication flow orchestration

- **Updated Components**:
  - `src/contexts/SimpleAuthProvider.tsx` - Added `signInWithApple()` method
  - `src/app/(auth)/login.tsx` - Integrated Apple Sign In button with error handling
  - `src/app/(auth)/signup.tsx` - Integrated Apple Sign In button with error handling

- **Configuration**:
  - `app.json` - Enabled Apple Sign-In capabilities
    - Set `usesAppleSignIn: true` for iOS
    - Added `expo-apple-authentication` plugin to plugins array
    - Configured Apple Team ID for proper app signing
  - Version bumped to 1.7.0 with build number 45

- **Dependencies**:
  - Added `expo-apple-authentication` (~8.0.7) for native Apple Sign-In
  - Uses existing `expo-crypto` for secure nonce generation
  - Uses existing `@expo/vector-icons` for Apple icon

### Notes

- **iOS Only**: Apple Sign-In is only available on iOS devices (13.0+)
- **App Store Requirement**: Required for apps that use other third-party sign-in options
- **Supabase Integration**: Uses Supabase Auth's `signInWithIdToken()` for seamless integration
- **Production Ready**: Fully tested with development builds on iOS
- **Developer Portal Setup**: Requires Apple Developer Portal configuration for production

---

## [1.5.4] - 2025-10-05

### Added

- **Google OAuth Authentication**: Complete Google Sign-In integration
  - **Browser-Based OAuth Flow**: Implemented using Supabase `signInWithOAuth()` + expo-web-browser
  - **Deep Linking Support**: Configured URL scheme (`dutchlearning://`) for OAuth callback handling
  - **Google Sign In Button**: HIG-compliant button following Google branding guidelines
    - Official Google "G" logo using @expo/vector-icons (AntDesign)
    - Proper color themes (light: white background, dark: #131314 background)
    - Correct dimensions (48px height, 4px border radius, 14px font size)
    - Text: "Continue with Google" as recommended by Google guidelines
  - **Seamless Integration**: Added to both login and signup screens with "OR" divider
  - **Auto-Navigation**: Automatic redirect to main app after successful authentication
  - **Error Handling**: Comprehensive error messages and loading states

### Fixed

- **OAuth Access Level Assignment**: Fixed user access level not being assigned correctly for OAuth users
  - **Case-Insensitive Email Matching**: Updated trigger to handle email case variations (curysef vs Curysef)
  - **Timing Issue Resolution**: Fixed issue where users registering before being added to whitelist got read_only access
  - **Email Normalization**: All emails in `pre_approved_emails` table now stored in lowercase
  - **Manual Sync Function**: Added `sync_user_access_levels()` for re-syncing existing users
  - **Trigger Enhancement**: Improved `assign_user_access_level()` with LOWER() comparison

- **OAuth Redirect Error**: Resolved "screen doesn't exist" error during OAuth callback
  - Changed redirect URL from `dutchlearning://auth/callback` to `dutchlearning://`
  - Simplified deep link detection to check only for `access_token` parameter
  - Improved OAuth callback handling in SimpleAuthProvider

### Technical

- **New Components**:
  - `src/components/auth/GoogleSignInButton.tsx` - Google branding compliant button component
  - `src/lib/googleAuth.ts` - OAuth helper functions (initiateGoogleOAuth, handleOAuthCallback, createSessionFromOAuthUrl)

- **Updated Components**:
  - `src/contexts/SimpleAuthProvider.tsx` - Added `signInWithGoogle()` method and deep link listener
  - `src/app/(auth)/login.tsx` - Integrated Google Sign In button with error handling
  - `src/app/(auth)/signup.tsx` - Integrated Google Sign In button with error handling

- **Database Migration**:
  - `supabase/migrations/20251005_fix_oauth_user_access_level.sql` - OAuth access level fixes

- **Configuration**:
  - `app.json` - Added `CFBundleURLTypes` for iOS deep linking support
  - URL Scheme: `dutchlearning://` for OAuth redirects

- **Dependencies**:
  - Uses existing `expo-web-browser` for OAuth flow
  - Uses existing `expo-linking` for deep link handling
  - No additional native dependencies required

### Notes

- **Recommended Approach**: Implementation follows official Supabase documentation for React Native OAuth
- **No Native SDK**: Uses browser-based OAuth instead of `@react-native-google-signin/google-signin` for simpler setup
- **Universal Provider**: Same OAuth flow works for all social providers (Google, GitHub, etc.)
- **Production Ready**: Fully tested with development builds on iOS and Android

---

## [1.5.3] - 2025-10-04

### Fixed

- **SecureStore Keychain Access**: Resolved "User interaction is not allowed" error (ERR_KEY_CHAIN)
  - Configured `keychainAccessible: AFTER_FIRST_UNLOCK` for all SecureStore operations
  - Allows session token access even when device is locked (after first unlock since boot)
  - Added comprehensive error handling with graceful degradation
  - Prevents app crashes when accessing keychain during restricted states
  - Fixes issue where fetching review words failed on app launch or background return

- **Review Session State Synchronization**: Fixed "Word not found in current words array" error
  - Added graceful handling in `updateWordAfterReview` when word is not in local cache
  - Word progress updates now persist to database even if local store is cleared
  - Review session automatically ends when user signs out to prevent orphaned state
  - Console warnings instead of Sentry errors for expected desync scenarios

### Technical

- **SecureStore Configuration**: Updated Supabase auth storage adapter
  - Applied `AFTER_FIRST_UNLOCK` accessibility to getItem, setItem, and removeItem operations
  - Try-catch blocks with error logging for all keychain operations
  - Null return on getItem errors for graceful session restoration
- **Error Handling**: Non-throwing failures to prevent auth flow interruption
- **State Management**: `endReviewSession()` called on user clear to maintain consistency
  - Prevents review session from continuing after sign out
  - Fixes race condition between auth state changes and review updates
  - Local cache (`store.words`) treated as UI optimization, not source of truth

---

## [1.5.2] - 2025-10-04

### Added

- **Password Reset Flow**: Complete forgot/reset password functionality
  - **Forgot Password Screen**: Email-based password reset request
  - **Reset Password Screen**: Secure password update with token validation
  - **Deep Link Support**: Automatic navigation from email reset links
  - **HIG-Compliant Navigation**: Header with back button and text link to login
  - **Form Validation**: Client-side password strength and match verification
  - **Success Messaging**: Clear user feedback with auto-redirect to login

### Fixed

- **Auth State Blocking**: Resolved `setSession()` hanging issue
  - Made `onAuthStateChange` listener non-blocking (fire-and-forget)
  - Prevents race condition between session setup and app initialization
  - Improved password reset flow performance

### Technical

- **Token Exchange**: Atomic session setup with password update
- **Deep Link Parsing**: Hash fragment to query params conversion for Supabase tokens
- **Route Constants**: Added `ROUTES.AUTH.FORGOT_PASSWORD` and `ROUTES.AUTH.RESET_PASSWORD`
- **Error Handling**: Comprehensive Sentry logging for password reset operations
- **Type Safety**: Full TypeScript compliance with proper error types

---

## [1.5.1] - 2025-10-03 (Build 42)

### Added

- **HIG-Compliant Settings Screen**: Complete redesign following Apple Human Interface Guidelines for iOS 26
  - **Liquid Glass Effect**: Applied BlurView (intensity: 100) to About, User Information, and Account sections
  - **Icon-First Design**: Removed 'About' title for cleaner, modern approach
  - **Adaptive App Icon**: Theme-aware icon variants (ios-light.png for light mode, ios-dark.png for dark mode)
  - **Legal Documentation**: Professional app information structure
    - Privacy Policy: TermsFeed hosted (https://www.termsfeed.com/live/3e576e8c-54c9-4543-b808-890d7c98f662)
    - Terms and Conditions: TermsFeed hosted (https://www.termsfeed.com/live/855aec0d-a235-42e8-af6f-28166c93901a)
    - License Agreement: Apple Standard EULA (http://www.apple.com/legal/itunes/appstore/dev/stdeula)
    - Credits & Acknowledgements: Technology stack modal (React Native, Expo, Supabase, Gemini AI, Unsplash)
  - **Optimized Layout**: Single-screen design with compact spacing
    - Reduced padding and margins (24px → 16px)
    - Optimized icon size (80x80 → 64x64)
    - App description: "Learn Dutch with AI-powered flashcards"

### Fixed

- **Dark Mode Background Consistency**: Fixed darker inner containers conflicting with parent backgrounds
  - **History Tab**: Transparent containers in WordAnalysisHistorySection and NotificationHistorySection
    - Fixed word items, headers, and details containers
    - Fixed notification items and content containers
  - **Collections Tab**: Transparent containers in StatsCard and SwipeableCollectionCard
    - Fixed statsRow and statItem containers in Today's Progress
    - Fixed cardContent, textContainer, and accessoryContainer in collection cards
  - **Collection Detail**: Transparent containers in CollectionStats
    - Fixed statsGrid and statItem containers in Collection Statistics section
  - **Unified Theme Experience**: All screens now have consistent background rendering in dark mode

### Technical

- **DRY Principle**: Color constants for repeated blur background values (blurBackgroundDark, blurBackgroundLight)
- **Type Safety**: All changes maintain strict TypeScript compliance with no `any` types
- **Code Quality**: ESLint compliant with minimal warnings (cognitive complexity within limits)
- **Platform Consistency**: Adaptive components work seamlessly across light/dark modes
- **Consistent Styling**: Liquid Glass implementation matches WordContextMenu patterns

---

## [1.5.0] - 2025-10-02 (Build 39-41)

### Added

- **Tiered Access Control System**: Complete implementation of user access levels
  - **Database Schema**: New `pre_approved_emails` and `user_access_levels` tables
  - **Access Levels**: `full_access` (can create content) and `read_only` (can import and learn)
  - **Email Whitelist**: Pre-approved emails get full access, others default to read-only
  - **Automatic Assignment**: Database trigger assigns access level on user registration
  - **Access Control Service**: New service for checking and managing user permissions
  - **UI Access Level Display**: Settings screen shows current access level with color coding

- **UI Restrictions for Read-Only Users**: Conditional UI based on access level
  - **Hidden Add Word Tab**: Add Word tab not shown for read-only users
  - **Hidden Create Collection Button**: Collection creation button hidden for read-only users
  - **Collection Context Menu**: Different menu options based on access level and collection count
  - **Delete Protection**: Read-only users cannot delete their last collection (UI + store validation)
  - **Toast Notifications**: User-friendly messages when attempting restricted actions

- **Default Collection Creation**: All users get a starter collection
  - **"My Words" Collection**: Automatically created on user registration
  - **SECURITY DEFINER Function**: Bypasses RLS to create collection for read-only users
  - **Backfill Support**: Existing users without collections receive default collection

- **Word Import for Read-Only Users**: Secure import system using SECURITY DEFINER
  - **Private Schema Pattern**: Created `private` schema for security-sensitive functions
  - **Import RPC Function**: `import_words_to_collection()` with ownership verification
  - **Public Wrapper**: SECURITY INVOKER wrapper for authenticated users
  - **Examples Handling**: Proper JSONB array conversion for examples field
  - **Conjugation Validation**: Only verbs can have conjugation data (check constraint fix)
  - **Schema Permissions**: Granted USAGE on private schema to authenticated users

- **Tab Layout Improvements**: Fixed Expo Router native tabs warnings
  - **Hidden Prop**: Using official `hidden` prop instead of conditional rendering
  - **No Layout Warnings**: Eliminated "Layout children must be of type Screen" warnings
  - **Proper Navigation**: Tab still registered but hidden from view

- **History Cleanup on Logout**: Clear user-specific data when switching accounts
  - **Word Analysis History**: Cleared on logout to prevent cross-user data leakage
  - **Notification History**: Cleared on logout for clean user sessions
  - **App Initialization**: Cleanup integrated into `initializeApp()` flow

- **Word Detail Modal in History Tab**: Tap on analyzed words in History to view full details
  - Opens same WordDetailModal as in collections for consistent UX
  - Modal renders at top level (above all content) for proper z-index behavior
  - Provides quick access to word information directly from History tab

- **Custom Search Query for Images**: Image selector now supports custom search queries
  - Text input field to modify search query (e.g., search for specific word meaning)
  - Useful for words with multiple meanings (uitdagen → provoke vs challenge)
  - Smart query initialization using useRef to preserve user edits
  - Search button with instant feedback and keyboard submit support

- **Plural Past Simple for Verb Conjugations**: Enhanced verb conjugation display
  - Added `simple_past_plural` field to conjugation data structure
  - Database migration with proper constraint validation
  - UI displays both singular (ik) and plural past simple forms
  - Improved Gemini prompt to extract plural conjugation forms

- **Adaptive Header Layout**: Word titles now handle long words gracefully
  - Auto-scaling font size for lengthy words (minimum 60% of original size)
  - Word title on first line (full width)
  - Action buttons (cache, copy, sound) on second line (right-aligned)
  - Works consistently across all word cards (collections, modals, review)

- **Real Streak Calculation**: Implemented actual study streak tracking
  - Calculates consecutive days with word reviews based on `last_reviewed_at`
  - Counts backwards from today or yesterday (if no review today)
  - Automatically resets on missed days
  - Replaces hardcoded `streakDays: 0` placeholder

### Changed

- **Collection Deletion Validation**: Enhanced validation for read-only users
  - **Store-Level Check**: `deleteCollection` action prevents deletion of last collection
  - **UI-Level Check**: `SwipeableCollectionCard` shows toast and returns card to position
  - **Context Menu**: Conditionally shows delete option based on collection count
  - **Error Messages**: Clear user-facing messages about restrictions

- **CollectionContextMenu Component**: Refactored to reduce complexity
  - **Separate Components**: Split into `ReadOnlyMenuItems` and `FullAccessMenuItems`
  - **Reduced Complexity**: Cognitive complexity reduced from 28 to below 15
  - **Better Maintainability**: Clearer separation of concerns by user type

- **Logging Improvements**: Better distinction between errors and expected validations
  - **Validation Logging**: Changed last collection deletion from `logError` to `logInfo`
  - **User-Friendly Messages**: Toast messages instead of silent failures

### Fixed

- **Import Function Bugs**: Multiple fixes for word import functionality
  - **JSONB Array Casting**: Fixed "cannot cast type jsonb to jsonb[]" error for examples
  - **Conjugation Check Constraint**: Fixed violation for non-verb words with conjugation data
  - **Schema Permissions**: Fixed "permission denied for schema private" error
  - **Type Validation**: Added `jsonb_typeof()` check to ensure array parameter

- **Collection Auto-Selection Bug** (HIGH PRIORITY): Fixed collection selection logic
  - Automatically selects first available collection when current selection becomes invalid
  - Handles scenario when selected collection is deleted
  - Re-validates selection when collections list changes
  - Ensures users can always add words efficiently without manual collection selection

### Database Migrations

- `20251002111946_add_user_access_control.sql`: Core access control schema and RLS updates
- `20251002122144_add_default_collection_for_users.sql`: Default collection creation logic
- `20251002122646_allow_word_import_for_readonly_users.sql`: Initial SECURITY DEFINER import function
- `20251002133549_grant_private_schema_usage.sql`: Schema permission grants
- `20251002134053_fix_import_words_function.sql`: JSONB array type validation fix
- `20251002140601_fix_import_examples_cast.sql`: Examples field array conversion fix
- `20251002142334_fix_import_conjugation_check.sql`: Conjugation check constraint fix

### Technical

- **New Utilities**:
  - `src/utils/streakUtils.ts` - Streak calculation with date normalization
- **Database Changes**:
  - Migration `20251002102613_add_simple_past_plural_to_conjugation.sql`
  - Updated conjugation constraints to support `simple_past_plural`
- **Type Updates**:
  - Extended `WordConjugation` interface in `database.ts`, `GeminiTypes.ts`, `AddWordTypes.ts`
- **Component Enhancements**:
  - Refactored `HeaderSection.tsx` for two-row layout
  - Enhanced `ImageSelector.tsx` with controlled search state
  - Updated `useAddWord.ts` with collection validation logic

---

## [1.4.0 Build 38] - 2025-10-02

### Added

- **Collection Search**: Real-time search functionality for words in collections
  - Debounced search input (300ms delay) with instant visual feedback
  - Search by Dutch lemma with substring matching support
  - Result counter showing "X of Y words" when searching
  - Platform-specific clear button behavior (iOS native, Android custom)
  - Full dark/light theme support with HIG-compliant design
  - Empty state handling for search results vs no words scenarios

- **Network Reliability Improvements**: Comprehensive error handling and retry system
  - Automatic retry mechanism for failed Edge Function calls (3 attempts: 1s, 2s, 4s delays)
  - 10-second timeout per request attempt (~37 seconds total with retries)
  - Network connectivity checks using expo-network before requests
  - Prevents indefinite request hanging on poor/offline connections
  - Error categorization system: `NetworkError`, `ServerError`, `ClientError`, `ValidationError`
  - User-friendly error messages with specific guidance for each error type
  - Enhanced Sentry error tracking with breadcrumbs and context

- **Dedicated History Tab**: Activity tracking following Apple HIG guidelines
  - New History tab positioned between Collections and Settings
  - iOS icon: `clock.fill`, Android icon: `history`
  - Proper separation of concerns (history vs settings configuration)
  - **Notification History**: Tracks last 20 toast notifications (ephemeral, cleared on restart)
  - **Word Analysis History**: Tracks last 3 analyzed words (persistent via AsyncStorage)
  - Visual indicators for notification types (✅ success, ❌ error, ℹ️ info)
  - Shows "Not added" or collection name for each analyzed word
  - Custom relative time formatter compatible with React Native Hermes (no external deps)

### Changed

- **Word Analysis Persistence**: Analysis results remain visible after adding word to collection
  - Add button hidden for duplicate words, but information still displayed
  - Better user context when reviewing analyzed words
  - Word history entries update when added to collection (no duplicates)
  - Preserves original timestamp when word status changes

### Fixed

- **Duplicate Word Detection**: Enhanced duplicate detection with improved UX
  - Fixed article handling in database queries (null vs empty string)
  - Added visual enhancements to duplicate banner with colored borders
  - Improved loading states during duplicate checking process
  - Added toast notifications when duplicates are detected

- **Production Network Error Resolution**
  - Resolved FunctionsFetchError: "Failed to send a request to the Edge Function"
  - Fixed requests hanging indefinitely on network issues (75+ seconds)
  - Proper error handling for offline/poor network conditions
  - Fixed stuck loading indicators (`isAnalyzing`, `isCheckingDuplicate`) when requests fail
  - Fixed `Colors.info` reference error (now uses `Colors.primary` for INFO toast type)

### Technical

- **New Components**: Added reusable search infrastructure
  - `CollectionSearchBar`: Feature-complete search input component
  - `useDebounce`: Reusable hook for performance optimization
  - `UIConstants`: Centralized timing and interaction constants

- **Network & Error Handling System**
  - New files:
    - `src/types/ErrorTypes.ts` - Error categorization system
    - `src/utils/retryUtils.ts` - Retry logic with exponential backoff
    - `src/utils/networkUtils.ts` - Network connectivity utilities
    - `src/utils/dateUtils.ts` - Custom date formatting for React Native
  - Modified: `src/lib/supabase.ts`, `src/components/AddWordScreen/hooks/useWordAnalysis.ts`
  - Configuration: 10s timeout per attempt, 3 retries with exponential backoff

- **History Tracking System**
  - New files:
    - `src/types/HistoryTypes.ts` - History state type definitions
    - `src/stores/useHistoryStore.ts` - Zustand store with persistence middleware
    - `src/components/HistorySections/NotificationHistorySection.tsx`
    - `src/components/HistorySections/WordAnalysisHistorySection.tsx`
    - `src/app/(tabs)/history.tsx` - Dedicated History screen
  - Storage: AsyncStorage for word history (persistent), in-memory for notifications (ephemeral)
  - Limits: 20 notifications, 3 analyzed words

- **Performance Optimizations**: Optimized search and filtering
  - Memoized word filtering with `useMemo` for efficient re-renders
  - Local state management for responsive text input
  - Debounced search calls to reduce unnecessary filtering operations

- **Dependencies Added**
  - `expo-network` - Network connectivity detection (v6.0.0)

---

## [1.3.0 Build 33] - 2025-09-29

### Fixed

- **Word Highlighting Animation**: Removed flashing/blinking animations for duplicate words in collections
  - Eliminated red highlight overlay animations that appeared when scrolling to duplicate words
  - Preserved smooth scroll-to-word functionality for navigation
  - Improved user experience by removing distracting visual effects
  - Maintained all other word interaction features (swipe gestures, selection, etc.)

### Changed

- **CollectionContent Component**: Refactored for improved rendering performance
  - Extracted keyExtractor and renderItem functions for better optimization
  - Removed unused import and improved code organization
  - Updated prop handling for highlighted word indication

- **SwipeableWordItem Component**: Streamlined highlighting system
  - Replaced complex highlight animation with simple border indication
  - Removed highlightOpacity animation state and related useEffect hooks
  - Simplified component interface by removing unused animation code
  - Maintained word status indicators and review badges

### Technical

- **Animation System Optimization**: Removed unnecessary highlight animations
  - Deleted highlight overlay styles and animation components
  - Simplified animated style calculations
  - Reduced component complexity and memory usage
  - Preserved core swipe gesture functionality

---

## [1.2.2 Build 32] - 2025-09-29

### Added

- **Collection Word Management**: Complete word management system within collections
  - Leading swipe gesture on words to move between collections with haptic feedback
  - Liquid Glass design tab bar center button for quick word addition
  - Floating action button in collection detail screens with blur effects
  - Move to Collection modal with Liquid Glass effects using expo-blur
  - Word count display in collection selectors for better visibility

- **Enhanced Expression Type System**: Comprehensive expression classification support
  - Added 5 new expression types: proverb, saying, fixed_expression, interjection, abbreviation
  - Created ExpressionType enum with 9 total expression types for consistency
  - Updated Gemini AI prompts with detailed instructions for all expression types
  - Enhanced validation to support punctuation marks for interjections and expressions

- **Settings Screen Enhancement**: Improved user information display
  - Added user profile information display
  - Enhanced app version details and build information
  - Improved layout and visual hierarchy

### Changed

- **Expression Type Architecture**: Migrated from string literals to TypeScript enum
  - Centralized ExpressionType enum for type safety across all components
  - Updated all type definitions to use consistent ExpressionType enum
  - Enhanced Gemini prompts with comprehensive expression type classification

### Fixed

- **Swipe Gesture Issues**: Resolved swipe position reset problems
  - Fixed leading swipe not returning to original position when modal is cancelled
  - Added proper state tracking for modal visibility per word
  - Improved swipe reset logic when user cancels collection selection

- **Collection Word Count Display**: Fixed incorrect word count in collection selectors
  - Implemented accurate word count calculation for collection move modal
  - Enhanced collection display with real-time word count updates

- **Expression Type Validation**: Fixed database constraint violations for new expression types
  - Updated Supabase database constraint to allow all 9 expression types
  - Fixed Edge Function validation to support punctuation marks (!, ?, ., etc.)
  - Enhanced error handling and logging for expression type processing

### Technical

- **iOS Design System Integration**: Implemented Apple HIG and Liquid Glass design patterns
  - Added expo-blur library for authentic glass effects
  - Integrated haptic feedback throughout gesture interactions
  - Created reusable Liquid Glass components for consistent UI
  - Followed iOS 26 design guidelines for gesture patterns

- **Database Schema Updates**: Enhanced expression type support
  - Database migration for expression_type constraint with all 9 types
  - Updated Edge Function validation to support extended character sets
  - Improved error logging and debugging capabilities

- **Gesture System Enhancement**: Advanced swipe gesture implementation
  - React Native Gesture Handler integration for smooth swipe interactions
  - Progressive disclosure pattern (short vs long swipe behaviors)
  - Proper gesture composition to prevent conflicts with other touch handlers

---

## [1.2.1 Build 31] - 2025-09-28

### Fixed

- **Keyboard Interaction Improvements**: Enhanced import modal keyboard handling
  - Fixed keyboard covering input field when importing collections on Android
  - Added platform-specific keyboard avoidance behavior (iOS: padding, Android: pan mode)
  - Configured softwareKeyboardLayoutMode in app.json for optimal Android experience
  - Improved focus management and input accessibility

- **Collection Action Menu Enhancement**: Added visual icons to collection management actions
  - Integrated Ionicons in collection long-press menus matching detail screen consistency
  - Added share, copy code, and stop sharing icons for better visual recognition
  - Maintained platform-native behavior (iOS ActionSheet text-only, Android custom sheet with icons)
  - Enhanced user experience with consistent iconography across app

### Technical

- **Platform-Specific UI Optimization**: Implemented adaptive UI patterns for iOS and Android
  - KeyboardAvoidingView with conditional platform behavior
  - Custom ActionSheet component for Android with icon support
  - Preserved native iOS ActionSheet limitations while enhancing Android experience
- **Build System Improvements**: Enhanced build and deployment workflow
  - Updated build scripts with proper error handling and color output
  - Implemented source map generation and Sentry integration
  - Added automated build number synchronization between platforms

---

## [1.1.0 Build 29] - 2025-09-27

### Added

- **In-App Collection Import**: Complete in-app collection sharing without deeplinks
  - Import modal with collection code input and validation
  - Long press context menus for collection sharing actions
  - Stop sharing functionality with confirmation dialogs
- **Enhanced Collection Management**: Improved collection sharing UX
  - Copy collection code directly from collection cards and detail screens
  - Start/stop sharing toggle with visual feedback
  - Native context menus (iOS ActionSheet, Android fallback)

### Changed

- **Collection Detail Screen Architecture**: Refactored large screen component following 2025 best practices
  - Extracted business logic into `useCollectionDetail` custom hook
  - Split UI into `CollectionDetailHeader` and `CollectionContent` components
  - Reduced cognitive complexity from 23 to under 15
- **Modern API Usage**: Updated to expo-clipboard for better performance and compatibility

### Fixed

- **Modal UX Improvements**: Enhanced import modal appearance and behavior
  - Auto-focus on input field when modal opens
  - Improved dark theme contrast with elevated background colors
  - Better visual separation with borders and shadows
- **Duplicate Detection**: Pre-import validation prevents importing existing words
- **Error Messages**: User-friendly error messages for invalid collection codes

### Technical

- **Component Architecture**: Implemented separation of concerns following Expo Router 2025 patterns
  - Business logic isolated in custom hooks
  - UI components focused on presentation only
  - Screen components handle navigation only
- **TypeScript Improvements**: Enhanced type safety without any type usage
- **Performance Optimizations**: Reduced bundle size through better component composition

---

## [1.1.0 Build 24] - 2025-09-26

### Added

- **Collection Sharing System**: Complete implementation of collection sharing functionality
  - Database schema for shared collections with proper RLS policies and constraints
  - Share button UI with centered positioning and improved visual feedback
  - Collection sharing UX with streamlined flow and enhanced user experience

### Changed

- **Import Screen Architecture**: Optimized screen architecture for better performance and maintainability
- **Shared Collection Components**: Extracted and refactored reusable components for better code organization

### Fixed

- **Gemini API Integration**: Updated error handling and improved API integration reliability
- **Share Button**: Resolved centering issues and improved sharing implementation

### Technical

- Enhanced database schema for collection sharing with proper constraints and indexes
- Improved component architecture with extracted reusable shared collection components
- Optimized import screen implementation for better performance
- Updated API integration with enhanced error handling and reliability

---

## [1.1.0 Build 23] - 2025-09-24

### Added

- **Complete Image Change Functionality**: Full image replacement system across the application
  - Image changing in review mode (card back side) with database and session state updates
  - Image changing in collection detail modal with immediate UI feedback
  - Cross-user image selection with 6+ image options per word
  - Database integration with proper state management for both contexts

### Fixed

- **Gesture System Improvements**: Enhanced interaction handling in review mode
  - Fixed audio button triggering unwanted card flips on review card back
  - Fixed delete button triggering card flips during deletion confirmation
  - Fixed image change button triggering card flips when selecting new images
  - All functional buttons now use GestureDetector with .blocksExternalGesture() for proper isolation

- **Word Analysis Display Issues**: Resolved separable verb information problems
  - Fixed "unknown" part of speech display for separable verbs (now correctly shows "verb")
  - Added missing separable verb grammar tags in word detail display
  - Fixed cache/fresh data inconsistencies in Edge Function responses
  - Improved fallback logic for cached data with null values

- **Dark Theme Support**: ImageSelector modal now fully supports dark mode
  - Replaced hardcoded light colors with adaptive color scheme system
  - Fixed container, header, text, and image card backgrounds for proper dark mode display
  - Updated close icon and all text elements to use appropriate colors
  - Enhanced shadow opacity and contrast for better dark mode visibility

### Technical

- Added updateWordImage and updateCurrentWordImage store actions with TypeScript support
- Enhanced gesture system architecture with consistent GestureDetector patterns
- Improved Edge Function caching logic with better fallback handling
- Created adaptive styling system for better dark theme support
- Fixed deprecated Sentry configuration options for latest SDK compatibility

---

## [1.1.0 Build 20] - 2025-09-24

### Fixed

- **Dark Theme Support**: Comprehensive dark theme improvements across all components
  - Fixed LoadingScreen background to properly adapt to dark theme
  - Improved readability of Analysis Notes and Conjugation sections in dark theme
  - Fixed WordDetailModal Progress section (Reviews, Easy Factor, Next Review) display
  - Resolved light background issues in various word card sections
  - Replaced all hardcoded colors with centralized Colors system constants
  - Enhanced theme-aware backgrounds for notes, conjugation, and translation containers

- **Swipe Gesture Improvements**: Enhanced swipe-to-delete and swipe-to-rename functionality
  - Implemented symmetric swipe actions with Apple HIG compliance for collection cards
  - Added dynamic button expansion with proper race gesture composition to prevent conflicts
  - Fixed deprecated runOnJS usage by migrating to scheduleOnRN for React Native Worklets compatibility
  - Improved word deletion UX with confirmation dialogs matching collection deletion pattern
  - Enhanced partial swipe visibility - icons and text now fully visible on short swipes
  - Optimized button expansion to occur only on long swipes (≥150px) for better readability

### Technical

- Enhanced crash reporting with proper Sentry source map uploads
- Improved gesture system stability with React Native Worklets migration
- Updated color system architecture for consistent theming

---

## [1.1.0 Build 18] - 2025-09-23

### Added

- **Analysis Notes Display**: Added read-only analysis notes field visible in all word display modes
  - Shows analysis notes in word analysis, modal, and review screens
  - Apple HIG compliant empty state placeholder when no notes available
  - Database migration adds `analysis_notes` column to words table
  - Full type safety with TypeScript interfaces

- **🚀 Smart Word Analysis Cache**: Intelligent caching system for word analysis results
  - **80-90% API cost reduction** through cross-user shared caching
  - **<100ms response times** for cached words vs 3-5s for fresh analysis
  - **30-day TTL** with automatic cleanup and usage tracking
  - **Force refresh capability** for bypassing stale cache when needed

- **🎨 Apple HIG Cache UI**: Native iOS-style cache status indicators
  - **Status badges**: "📁 Cache" vs "🤖 AI" source indicators
  - **Smart refresh button**: Appears only for cached results
  - **Usage statistics**: Shows cache hit count in toast messages
  - **Timestamp display**: Subtle cache date information
  - **Contextual actions**: Following iOS Human Interface Guidelines

### Changed

- **Toast System Simplification**: Streamlined notification system following UX best practices
  - Reduced from 4 toast types to 3 (SUCCESS, ERROR, INFO)
  - Replaced 10+ specialized methods with single `ToastService.show()` API
  - Implemented Apple HIG compliant colors for light and dark themes
  - Optimized timing based on UX research (3s success, 4s error, 2.5s info)
  - Migrated 40+ toast calls across 13 files to new simplified API
  - Added comprehensive documentation to prevent future complexity

### Enhanced

- **Database Architecture**: New `word_analysis_cache` table with proper indexing
  - Cross-user shared cache (no user_id dependency)
  - PostgreSQL RLS policies for secure read-only access
  - Optimized database functions for cache operations
  - Built-in TTL and usage tracking

- **Edge Function Optimization**: Production-ready `gemini-handler` improvements
  - Minimal production logging (removed debug verbosity)
  - Enhanced error handling and response metadata
  - Cache-first logic with intelligent fallbacks
  - Async cache saving for non-blocking performance

### Technical

- Enhanced UniversalWordCard component with NotesSection
- Updated database schema with proper column documentation
- Improved type definitions for analysis data flow
- Consolidated toast configuration for better maintainability

- **TypeScript Enhancements**: Complete type safety for cache operations
  - New `AnalysisMetadata` interface for cache information
  - Enhanced `UniversalWordCard` props for cache display
  - Updated service layer with cache-aware responses

- **Performance Optimizations**: Smart caching strategy implementation
  - Word normalization for consistent cache keys
  - Incremental usage statistics tracking
  - Background cache population for popular words
  - Production-optimized logging and error handling

---

## [Build 5] - Current Production

- Enhanced word analysis with synonyms, antonyms, and grammar information
- Improved image selection and display functionality
- Comprehensive gesture system implementation
- Modern UI/UX improvements

---

_Previous builds documented in PROJECT_PLAN.md_
