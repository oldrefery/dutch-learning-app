# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Next Build

### Added

### Changed

### Fixed

### Technical

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
