# In-App Collection Import Feature Design Document

## Overview

This document outlines the design and implementation plan for in-app collection sharing and importing functionality. Users will be able to share collections via codes and import collections directly within the app, eliminating the need for deeplinks.

## Feature Requirements

### 1. Collection Sharing (For Collection Owners)

#### 1.1 SwipeableCollectionCard - Long Press Context Menu

- **Behavior:** Long press triggers native iOS/Android context menu
- **Logic:**
  - If collection `is_shared = true` → Display "Copy Code" option
  - If collection `is_shared = false` → Display "Share Collection" option
- **Actions:**
  - **Copy Code:** Copies `share_token` to clipboard, shows toast "Code copied"
  - **Share Collection:** Executes `shareCollection()`, then copies token to clipboard

#### 1.2 Collection Detail Screen - Header Button

- **Behavior:** Dynamic button replacement based on sharing status
- **Logic:**
  - If collection `is_shared = true` → Show "Copy Code" button
  - If collection `is_shared = false` → Show "Share" button
- **UI:** Icon following iOS 26 HIG / Material Design 3 guidelines for copy action

### 2. Collection Importing (For Recipients)

#### 2.1 Main Screen - Import Button

- **Location:** In SectionHeader next to "Create Collection" button
- **UI:**
  - Icon: `cloud-download-outline` (Ionicons)
  - Text: Following iOS 26 HIG / Material Design 3 guidelines
- **Action:** Opens import modal

#### 2.2 Import Modal

- **Design:** iOS 26 HIG / Material Design 3 compliant modal
- **Components:**
  - Title: "Import Collection"
  - Input field: "Enter collection code"
  - Buttons: "Cancel" / "Import"
- **Validation Flow:**
  - On Import tap: Apply `token.trim()`
  - Validate via `collectionSharingService.getSharedCollection(token)`
  - If error: Display red error text below input field (following design guidelines)
  - If success: Close modal → Navigate to `import/[token].tsx`

## Technical Implementation

### 3.1 API Integration

- **Service:** Reuse existing `collectionSharingService`
- **Methods:**
  - `shareCollection()` - Share collection and get token
  - `getSharedCollection()` - Validate token and get collection info
  - `getSharedCollectionWords()` - Get full collection data for import

### 3.2 Navigation Flow

- **Import Screen:** Reuse existing `import/[token].tsx`
- **Import Logic:** Reuse existing `useImportSelection` hook
- **No changes needed** to existing import functionality

### 3.3 User Experience

- **Clipboard:** Copy raw `share_token` only
- **Notifications:** Toast messages for all user actions
- **Menus:** Native platform context menus
- **Error Handling:** Inline error display following platform guidelines

## File Changes Required

### Components to Modify

1. `SwipeableCollectionCard.tsx` - Add long press context menu
2. `src/app/collection/[id].tsx` - Update header button logic
3. `src/app/(tabs)/index.tsx` - Add import button to collections section
4. `SectionHeader.tsx` - Add import button support (if component exists)

### New Components

1. `ImportByTokenModal.tsx` - Token input modal component

### Dependencies

- Native context menu APIs (iOS/Android)
- Clipboard API
- Existing collection sharing service
- Existing import screens and hooks

## Design Guidelines Reference

- **iOS:** iOS 26 Human Interface Guidelines
- **Android:** Material Design 3 Guidelines
- **Icons:** Ionicons library
- **Error States:** Platform-specific error presentation patterns

## Success Criteria

1. Users can share collections by copying codes from long press menu
2. Users can share collections from detail screen header
3. Users can import collections via code input on main screen
4. Error handling follows platform guidelines
5. Seamless integration with existing import flow
6. Native look and feel across platforms

## Implementation Order

1. Create `ImportByTokenModal` component
2. Add import button to main screen
3. Implement long press context menu for collection cards
4. Update collection detail screen header
5. Test integration with existing import flow
6. Polish UI/UX according to platform guidelines

---

_This document serves as the implementation blueprint for the in-app collection import feature development._
