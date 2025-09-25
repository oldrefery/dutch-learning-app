# Collection Sharing & Word Management - Task Breakdown

## Status: ✅ Phase 4 COMPLETED - Build 24 Released

---

## 🎯 OVERVIEW

✅ **COMPLETED in Build 24 (September 2025)**

This phase introduced collection sharing functionality and enhanced word management following platform-compliant UX patterns.

### Implementation Summary:

- **Database Schema**: Complete collection sharing database implementation
- **Share Button UI**: Centered share button with improved visual feedback
- **Collection UX**: Enhanced user experience and streamlined sharing flow
- **Component Architecture**: Extracted reusable shared collection components
- **Import Screen**: Optimized architecture for better performance
- **API Integration**: Improved Gemini API error handling and reliability

### Key Principles:

- **Platform Compliance**: Follow iOS HIG and Material Design guidelines
- **Unified UX**: Consistent interaction patterns across platforms
- **User Safety**: Clear confirmations for destructive actions
- **Accessibility**: Screen reader friendly interfaces

---

## 📊 DATABASE CHANGES

### 1. Collections Table Updates

```sql
-- Add sharing capabilities to existing collections table
ALTER TABLE collections ADD COLUMN share_code text UNIQUE;
ALTER TABLE collections ADD COLUMN is_shareable boolean DEFAULT false;
ALTER TABLE collections ADD COLUMN shared_at timestamptz;

-- Create index for fast share_code lookups
CREATE INDEX idx_collections_share_code ON collections(share_code);
```

### 2. Optional Import Tracking Table

```sql
-- Track collection imports for analytics (optional)
CREATE TABLE collection_imports (
  import_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_collection_id uuid REFERENCES collections(collection_id),
  imported_by_user_id uuid REFERENCES users(id),
  imported_to_collection_id uuid REFERENCES collections(collection_id),
  imported_words_count integer,
  created_at timestamptz DEFAULT now()
);
```

---

## 🛠️ IMPLEMENTATION TASKS

### Phase 4.1: Enhanced Word Management (Priority 1)

#### Task 4.1.1: Context Menu System

- [ ] **Create WordContextMenu Component**
  - Cross-platform context menu (iOS/Android native feel)
  - Actions: Word Details, Move to Collection, Copy to Collection, Delete
  - Proper haptic feedback and animations
  - File: `src/components/WordContextMenu/WordContextMenu.tsx`

- [ ] **Update SwipeableWordItem Component**
  - Remove swipe-to-delete functionality
  - Add long-press gesture detection
  - Integrate with WordContextMenu
  - Maintain existing tap-to-view functionality

#### Task 4.1.2: Word Management Actions

- [ ] **Move Word Between Collections**
  - Collection picker modal with search
  - Update word's collection_id
  - Refresh UI state
  - Success/error toast notifications

- [ ] **Copy Word to Collection**
  - Create new word entry with same content
  - Reset SRS data (fresh learning progress)
  - Handle duplicate prevention in target collection
  - Preserve original word analysis data

- [ ] **Enhanced Delete Word**
  - Confirmation dialog with word preview
  - Soft delete option (future consideration)
  - Success feedback

#### Task 4.1.3: Collection Header Actions

- [ ] **Update Collection Screen Header**
  - Add platform-appropriate action buttons
  - iOS: Right header buttons
  - Android: Overflow menu (three dots)
  - Actions: Share, Edit Name, Delete Collection

- [ ] **Remove Collection-Level Swipe Actions**
  - Update collection list items
  - Move all actions to context menus or headers

### Phase 4.2: Collection Sharing System (Priority 2)

#### Task 4.2.1: Share Code Generation

- [ ] **Share Service Implementation**
  - Generate unique 8-character codes using nanoid
  - Update collection with share_code, is_shareable, shared_at
  - Create shareable URL (app schema + web fallback)
  - File: `src/services/collectionSharingService.ts`

- [ ] **Share Button Integration**
  - Add to collection header actions
  - Generate share link on tap
  - Native share sheet integration (iOS/Android)
  - Copy to clipboard fallback

#### Task 4.2.2: Deep Link Handling

- [ ] **Expo Router Configuration**
  - Update app.json with custom URL scheme
  - Configure universal links for web
  - Handle `dutchapp://share/[code]` URLs

- [ ] **Share Link Processing**
  - Parse incoming share URLs
  - Validate share codes
  - Handle expired/invalid links gracefully
  - Redirect to import preview screen

#### Task 4.2.3: Import Preview Screen

- [ ] **Create Share Import Screen**
  - File: `src/app/share/[code].tsx`
  - Display shared collection metadata
  - Show word list with checkboxes for selection
  - Preview word details (translations, examples)
  - Loading states and error handling

- [ ] **Collection Import Logic**
  - Fetch shared collection data by share_code
  - Validate user permissions
  - Handle private vs shareable collections
  - RLS policy enforcement

### Phase 4.3: Import & Target Selection (Priority 3)

#### Task 4.3.1: Selective Word Import

- [ ] **Word Selection Interface**
  - Checkbox list of available words
  - Select All/None toggle
  - Search/filter words
  - Word count and preview

- [ ] **Target Collection Picker**
  - List user's existing collections
  - "Create new collection" option
  - Collection name input for new collections
  - Validation and error handling

#### Task 4.3.2: Import Processing

- [ ] **Word Copying Logic**
  - Copy selected words to target collection
  - Reset SRS data for imported words
  - Handle duplicate word prevention
  - Preserve AI analysis data (translations, examples, images)

- [ ] **Import Completion Flow**
  - Success confirmation with import summary
  - Navigate to target collection
  - Optional: Track import in analytics table

---

## 🎨 UI/UX COMPONENTS

### New Components Needed:

1. **WordContextMenu** - Cross-platform context menu
2. **CollectionPicker** - Modal for choosing target collections
3. **ShareImportScreen** - Preview and import shared collections
4. **HeaderActionButtons** - Platform-appropriate header actions
5. **ImportSummaryModal** - Confirmation of successful imports

### Updated Components:

1. **SwipeableWordItem** - Remove swipe actions, add long-press
2. **Collection Header** - Add share/edit/delete actions
3. **Collection List** - Remove swipe actions if any

---

## 🔗 DEEP LINKS ARCHITECTURE

### URL Patterns:

```
dutchapp://share/ABC123XY    // Custom scheme (primary)
https://dutch-app.com/share/ABC123XY    // Universal link (fallback)
```

### Expo Router Structure:

```
src/app/
├── share/
│   └── [code].tsx           // Import preview screen
├── collection/
│   ├── [id].tsx            // Existing collection view (updated)
│   └── picker/
│       └── [wordId].tsx    // Collection picker for moving words
```

---

## 🛡️ SECURITY & PERMISSIONS

### RLS Policies:

```sql
-- Allow reading shareable collections
CREATE POLICY "Allow reading shareable collections" ON collections
  FOR SELECT USING (is_shareable = true);

-- Prevent non-owners from modifying shared collections
CREATE POLICY "Only owner can modify collection" ON collections
  FOR UPDATE USING (user_id = auth.uid());
```

### Privacy Considerations:

- Share codes expire after reasonable time (future enhancement)
- Only shareable collections visible via share links
- User data remains private (no cross-user data leakage)
- Import actions require user confirmation

---

## 📋 TESTING CHECKLIST

### Unit Tests:

- [ ] Share code generation and validation
- [ ] Word copying logic (SRS data reset)
- [ ] Deep link URL parsing
- [ ] Context menu action handling

### Integration Tests:

- [ ] End-to-end sharing flow
- [ ] Import preview and selection
- [ ] Word management actions
- [ ] Cross-platform UI consistency

### Manual Testing:

- [ ] iOS context menu behavior
- [ ] Android context menu behavior
- [ ] Deep link handling from various sources
- [ ] Share sheet integration
- [ ] Error handling for invalid/expired links

---

## 🚀 DEPLOYMENT CONSIDERATIONS

### Database Migrations:

1. Add columns to collections table
2. Create optional import tracking table
3. Update RLS policies

### App Configuration:

1. Update app.json with URL schemes
2. Configure universal links domain
3. Test deep link handling on both platforms

### Rollout Strategy:

1. Deploy database changes first
2. Release app update with new features
3. Monitor share link usage and performance
4. Gather user feedback for improvements

---

## 📊 SUCCESS METRICS

### Primary KPIs:

- Collection sharing adoption rate
- Word import completion rate
- User retention after using shared collections
- Reduction in duplicate content creation

### Secondary Metrics:

- Context menu usage vs previous swipe actions
- Time to complete word management tasks
- User satisfaction with new UX patterns
- Support ticket reduction for confusing interactions

---

_This breakdown provides a comprehensive roadmap for implementing collection sharing and enhanced word management in Phase 4._
