# E2E Test Plan for Dutch Learning App

This document outlines the comprehensive end-to-end testing strategy for the Dutch Learning App using Maestro.

## Test Coverage Status

### ✅ Currently Implemented (11 tests)

1. **Authentication Flows**
   - `01-auth-login.yaml` - User login with credentials
   - `02-auth-signup.yaml` - New user registration
   - `08-auth-logout.yaml` - User logout
   - `10-auth-forgot-password.yaml` - Password reset flow

2. **Validation Flows**
   - `04-validation-invalid-email.yaml` - Invalid email format
   - `05-validation-short-password.yaml` - Password too short
   - `06-validation-wrong-credentials.yaml` - Incorrect login credentials
   - `07-validation-password-length.yaml` - Password length requirements

3. **Navigation Flows**
   - `03-app-navigation.yaml` - Tab navigation
   - `09-navigation-forgot-password.yaml` - Navigate to forgot password
   - `11-navigation-signup.yaml` - Navigate to signup

---

## 🔴 High Priority Tests (Core User Flows)

### 1. Add Word Flow

**File:** `12-word-add-new.yaml`

**Purpose:** Test the primary user action - adding a new Dutch word to the vocabulary

**Test Steps:**

1. Navigate to "Add Word" tab
2. Input Dutch word (e.g., "lopen")
3. Wait for Gemini AI analysis to complete
4. Verify translations appear
5. Verify examples are displayed
6. Select collection from dropdown
7. Tap "Save Word" button
8. Verify success toast notification
9. Navigate to collection
10. Verify word appears in the list

**Critical Validations:**

- Gemini analysis completes successfully
- Word data is properly formatted
- Word is saved to correct collection
- UI updates immediately after save

---

### 2. Review Flow - Flashcard Interaction

**File:** `13-review-flashcard-flow.yaml`

**Purpose:** Test the core spaced repetition system (SRS) learning flow

**Test Steps:**

1. Ensure at least 3 words are due for review
2. Navigate to "Review" tab
3. Verify card front displays (Dutch word with article)
4. Tap card to flip (single tap)
5. Verify card back displays (translations, examples, grammar)
6. Tap "Good" button
7. Verify next card appears
8. Complete review session (all words)
9. Verify completion screen appears
10. Verify "Review Again" button

**Critical Validations:**

- Card flip animation works
- SRS buttons function correctly
- Word progress is updated
- Session state is maintained
- Completion screen shows correct stats

---

### 3. Review Flow - Empty State

**File:** `14-review-empty-state.yaml`

**Purpose:** Verify behavior when no words are due for review

**Test Steps:**

1. Ensure no words are due for review
2. Navigate to "Review" tab
3. Verify empty state message displays
4. Verify "No words to review" text
5. Verify suggestion to add more words

**Critical Validations:**

- Empty state UI is user-friendly
- No crash when review queue is empty

---

### 4. Collection Creation

**File:** `15-collection-create.yaml`

**Purpose:** Test creating a new word collection

**Test Steps:**

1. Navigate to "Collections" tab
2. Tap "Create Collection" button (+ icon or FAB)
3. Verify modal/sheet opens
4. Input collection name (e.g., "Verbs")
5. Tap "Create" button
6. Verify modal closes
7. Verify new collection appears in list
8. Verify success toast

**Critical Validations:**

- Modal opens and closes properly
- Collection name is saved correctly
- UI updates with new collection
- Collection is persisted to database

---

### 5. Collection Rename

**File:** `16-collection-rename.yaml`

**Purpose:** Test renaming an existing collection

**Test Steps:**

1. Navigate to "Collections" tab
2. Swipe left on collection card to reveal actions
3. Tap "Edit" or "Rename" button
4. Verify rename modal opens with current name
5. Clear existing text
6. Input new name (e.g., "Dutch Verbs")
7. Tap "Rename" or "Save" button
8. Verify modal closes
9. Verify collection name updated in list

**Critical Validations:**

- Swipe gesture reveals actions
- Current name pre-fills in input
- Name change persists
- UI updates immediately

---

### 6. Collection Delete

**File:** `17-collection-delete.yaml`

**Purpose:** Test deleting a collection (destructive action)

**Test Steps:**

1. Navigate to "Collections" tab
2. Create test collection (or use existing)
3. Swipe left on collection card
4. Tap "Delete" button
5. Verify confirmation alert appears
6. Read alert message (should warn about word deletion)
7. Tap "Delete" confirmation
8. Verify collection removed from list
9. Verify success toast

**Critical Validations:**

- Confirmation alert prevents accidental deletion
- Collection and associated words are deleted
- UI updates correctly
- No crashes after deletion

---

### 7. Collection Detail - View Words

**File:** `18-collection-view-words.yaml`

**Purpose:** Test viewing words within a collection

**Test Steps:**

1. Navigate to "Collections" tab
2. Tap on collection card
3. Verify collection detail screen opens
4. Verify collection name in header
5. Verify collection stats display (total, mastered, due)
6. Verify word list displays
7. Verify each word shows:
   - Dutch word with article
   - English translation
   - Status badge (new/learning/mastered)
8. Verify search bar is visible
9. Tap back button
10. Verify returns to collections list

**Critical Validations:**

- Navigation works correctly
- All word data displays properly
- Stats are calculated accurately
- Performance with 10+ words

---

### 8. Word Delete - Swipe Gesture

**File:** `19-word-delete-swipe.yaml`

**Purpose:** Test deleting a word using swipe gesture

**Test Steps:**

1. Navigate to collection with at least 1 word
2. Swipe left on word item (>80px)
3. Verify delete button (trash icon) reveals
4. Tap delete button
5. Verify confirmation alert appears
6. Read alert text (shows word being deleted)
7. Tap "Delete" confirmation
8. Verify word removed from list
9. Verify collection stats update
10. Verify success toast

**Critical Validations:**

- Swipe gesture works smoothly
- Haptic feedback on long swipe (>150px)
- Confirmation prevents accidents
- Word is deleted from database
- UI updates immediately

---

### 9. Word Move Between Collections

**File:** `20-word-move-collection.yaml`

**Purpose:** Test moving a word to a different collection

**Test Steps:**

1. Ensure at least 2 collections exist
2. Navigate to first collection
3. Swipe right on word item (>80px)
4. Verify move button (folder icon) reveals
5. Tap move button
6. Verify "Move to Collection" modal opens
7. Verify list of target collections displays
8. Tap on target collection
9. Verify modal closes
10. Verify word removed from current list
11. Navigate to target collection
12. Verify word appears in target collection

**Critical Validations:**

- Swipe gesture works in both directions
- Modal shows all available collections
- Word moves atomically (no duplicates)
- Both collections update correctly

---

### 10. Word Detail Modal

**File:** `21-word-detail-modal.yaml`

**Purpose:** Test viewing full word information in modal

**Test Steps:**

1. Navigate to collection with words
2. Tap on word item
3. Verify modal slides up from bottom
4. Verify modal displays:
   - Dutch word with article
   - Part of speech
   - Pronunciation button (speaker icon)
   - English translations
   - Usage examples (with images)
   - Synonyms
   - Antonyms
   - Grammar info (conjugations if verb)
   - Status badge
   - Next review date
5. Tap pronunciation button (verify audio plays)
6. Scroll through modal content
7. Swipe down to dismiss modal
8. Verify modal closes with animation

**Alternative Close:** 9. Tap on word again 10. Tap outside modal (backdrop) 11. Verify modal closes

**Critical Validations:**

- Modal animations are smooth
- All word data renders correctly
- Pronunciation audio works
- Scrolling works within modal
- Multiple dismiss methods work

---

## 🟡 Medium Priority Tests (Important Features)

### 11. Collection Sharing

**File:** `22-collection-share.yaml`

**Purpose:** Generate and copy collection share code

**Test Steps:**

1. Navigate to collection with words
2. Swipe on collection card
3. Tap "Share" button
4. Verify share code copied to clipboard
5. Verify success toast displays

---

### 12. Collection Import

**File:** `23-collection-import.yaml`

**Purpose:** Import words from shared collection

**Test Steps:**

1. Have valid share code available
2. Tap "Import Collection" button
3. Paste share code
4. Verify import selection screen opens
5. Verify word preview displays
6. Select words to import (checkboxes)
7. Toggle "Select All"
8. Toggle "Filter Duplicates"
9. Select target collection
10. Tap "Import" button
11. Verify progress indicator
12. Verify success message
13. Navigate to collection
14. Verify imported words appear

---

### 13. Collection Word Search

**File:** `24-collection-search-words.yaml`

**Purpose:** Filter words using search bar

**Test Steps:**

1. Navigate to collection with 5+ words
2. Tap search bar
3. Input search term (e.g., "loop")
4. Verify filtered results display
5. Verify non-matching words hidden
6. Tap clear button (X)
7. Verify all words return

---

### 14. Word Context Menu

**File:** `25-word-context-menu.yaml`

**Purpose:** Access word actions via long press

**Test Steps:**

1. Navigate to collection
2. Long-press word item (500ms minimum)
3. Verify haptic feedback
4. Verify context menu appears
5. Verify menu options:
   - Reset Progress
   - Move to Collection
   - Delete Word
6. Tap "Reset Progress"
7. Verify confirmation
8. Verify word progress reset (next_review_date, repetition_count)

---

### 15. Stats Dashboard Navigation

**File:** `26-stats-dashboard-navigation.yaml`

**Purpose:** Navigate from dashboard to review

**Test Steps:**

1. Navigate to "Collections" tab
2. Verify "Today's Progress" card displays
3. Verify stats show:
   - Total words
   - Mastered count
   - Due for review count
   - Current streak
4. Tap "Review Now" button
5. Verify navigates to Review tab
6. Verify review session starts

---

### 16. Add Word - Duplicate Detection

**File:** `27-word-add-duplicate.yaml`

**Purpose:** Handle adding existing word

**Test Steps:**

1. Add word "lopen" to collection A
2. Navigate to "Add Word"
3. Input "lopen" again
4. Wait for analysis
5. Verify duplicate warning displays
6. Verify shows existing collections
7. Select different collection (B)
8. Tap "Save Word"
9. Verify word added to collection B
10. Verify warning that word exists elsewhere

---

## 🟢 Lower Priority Tests (Edge Cases & Polish)

### 17. Pull-to-Refresh

**File:** `28-collections-pull-refresh.yaml`

**Purpose:** Test refresh functionality

**Test Steps:**

1. Navigate to Collections tab
2. Pull down from top of screen
3. Verify loading indicator appears
4. Wait for refresh to complete
5. Verify collections reload
6. Verify updated data displays

---

### 18. Empty States

**File:** `29-empty-states.yaml`

**Purpose:** Verify empty state messages

**Test Steps:**

1. New user with no collections
2. Verify empty collections message
3. Create collection (no words)
4. Open collection
5. Verify empty words message
6. Navigate to Review tab
7. Verify "no reviews" message

---

### 19. Offline Mode - Add Word

**File:** `30-word-add-offline.yaml`

**Purpose:** Test offline word addition

**Test Steps:**

1. Enable airplane mode
2. Navigate to "Add Word"
3. Input Dutch word
4. Verify error message (no network)
5. Disable airplane mode
6. Try again
7. Verify analysis completes

---

### 20. Invalid Word Input

**File:** `31-word-add-invalid-input.yaml`

**Purpose:** Validate input handling

**Test Steps:**

1. Navigate to "Add Word"
2. Input invalid characters (e.g., "!!!")
3. Verify validation error
4. Input empty string
5. Verify save button disabled
6. Input extremely long string (>200 chars)
7. Verify error or truncation

---

## Test Execution Strategy

### Local Testing

```bash
# Run all tests
npm run e2e:test:all:ios

# Run specific priority
maestro test .maestro/12-*.yaml  # High priority
maestro test .maestro/22-*.yaml  # Medium priority
```

### CI/CD Pipeline

- Run smoke tests on every commit
- Run high priority tests on PR to main/develop
- Run full test suite nightly
- Run full test suite before releases

### Test Data Management

- Use dedicated test user account
- Clean state before each test run
- Use predictable test data (e.g., "Test Collection 1")
- Reset database between test suites

### Performance Benchmarks

- App launch: < 3 seconds
- Tab navigation: < 500ms
- Word analysis: < 10 seconds
- Modal open/close: < 300ms

---

## Implementation Priority

**Phase 1 (Week 1):** High Priority Tests #12-21

- Add Word Flow
- Review Flow (SRS)
- Collection CRUD
- Word Management

**Phase 2 (Week 2):** Medium Priority Tests #22-27

- Sharing & Import
- Search & Context Menus
- Dashboard Interactions

**Phase 3 (Week 3):** Lower Priority Tests #28-31

- Edge Cases
- Error Handling
- Polish & Refinement

---

## Notes

- All tests should follow Maestro best practices
- Use `testID` props for critical elements
- Add `waitForAnimationToEnd` after navigation
- Include descriptive comments in YAML files
- Test on both iOS and Android platforms
- Verify haptic feedback on supported devices
- Test with both light and dark themes
