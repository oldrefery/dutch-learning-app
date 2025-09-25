# Collection Sharing - Simplified Implementation Plan

## Status: Ready for Implementation

**Branch:** `feature/collection-sharing`
**Approach:** Simplified UX following Anki/Memrise patterns

---

## 🎯 OVERVIEW

Implementation of collection sharing functionality with UUID-based secure sharing and intuitive UX flow.

### Key Features:

- **Secure Sharing:** UUID-based share tokens
- **Native UX:** iOS/Android share sheet integration
- **Preview-First:** Show collection overview before import
- **Flexible Import:** "Add All" or selective word import
- **Collection Choice:** Import to existing or new collection

---

## 🗄️ DATABASE CHANGES

### Collections Table Updates

```sql
-- Add sharing capabilities to existing collections table
ALTER TABLE public.collections
ADD COLUMN is_shared BOOLEAN DEFAULT FALSE,
ADD COLUMN share_token UUID UNIQUE DEFAULT gen_random_uuid(),
ADD COLUMN shared_at TIMESTAMPTZ;

-- Create index for fast share_token lookups
CREATE INDEX idx_collections_share_token ON public.collections(share_token);

-- RLS Policy for reading shared collections (authenticated users only)
CREATE POLICY "Allow reading shared collections" ON public.collections
  FOR SELECT TO authenticated USING (is_shared = true);
```

### Updated Collection Interface

```typescript
export interface Collection {
  collection_id: string
  user_id: string
  name: string
  created_at: string
  // New fields for sharing
  is_shared: boolean
  share_token: string | null
  shared_at: string | null
}
```

---

## 🎨 UX FLOW

### 1. Share Collection Flow

**Trigger:** Share button in collection header/context menu

```
[Collection: "Basic Words"]
├── Share button pressed
├── Generate share_token (uuid)
├── Update: is_shared=true, shared_at=now()
├── Create URL: dutchapp://share/{uuid}
└── Open Native Share Sheet
```

**Native Share Sheet Integration:**

```typescript
import * as Sharing from 'expo-sharing'

const shareCollection = async (collection: Collection) => {
  const shareUrl = `dutchapp://share/${collection.share_token}`

  await Sharing.shareAsync(shareUrl, {
    dialogTitle: `Share collection "${collection.name}"`,
  })
}
```

### 2. Import Preview Screen

**Route:** `src/app/share/[token].tsx`
**Deep Link:** `dutchapp://share/{uuid}`

```
┌─────────────────────────────────┐
│    📚 "Basic Words"             │
│         (23 words)              │
│                                 │
│  🔹 huis - house, дом          │
│  🔹 eten - to eat, есть        │
│  🔹 water - water, вода        │
│  🔹 ...and 20 more words       │
│                                 │
│  ┌─────────────┐ ┌───────────┐  │
│  │ Add All     │ │ Select    │  │
│  │             │ │ Words     │  │
│  └─────────────┘ └───────────┘  │
└─────────────────────────────────┘
```

### 3. Word Selection Screen (Optional)

**Shown when:** User clicks "Select Words"

```
┌─────────────────────────────────┐
│  Select words to import:        │
│                                 │
│  ☑️ [Select all] [Clear all]    │
│                                 │
│  ☑️ huis - house, дом          │
│  ☑️ eten - to eat, есть        │
│  ☐ water - water, вода         │
│  ☑️ boek - book, книга         │
│  ...                           │
│                                 │
│  Selected: 15 of 23 words       │
│                                 │
│  ┌─────────────────────────────┐ │
│  │         Next                │ │
│  └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 4. Target Collection Selection

```
┌─────────────────────────────────┐
│   Add to collection:            │
│                                 │
│  📁 My Collections:             │
│                                 │
│  ○ Basic Words (12 words)       │
│  ○ Food & Drinks (8 words)      │
│  ○ Travel (5 words)             │
│                                 │
│  ➕ [Create new collection]     │
│                                 │
│  ┌─────────────────────────────┐ │
│  │        Import               │ │
│  └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## 🔧 TECHNICAL IMPLEMENTATION

### Phase 1: Database & Backend Setup

1. **Create Supabase Migration**

   ```bash
   npx supabase migration new add_collection_sharing
   ```

2. **Update Database Types**

   ```typescript
   // src/types/database.ts - update Collection interface
   ```

3. **Update RLS Policies**
   - Allow reading shared collections by share_token (authenticated users only)
   - Prevent modification of shared collections by non-owners

### Phase 2: Sharing Functionality

1. **Collection Sharing Service**

   ```typescript
   // src/services/collectionSharingService.ts
   export const shareCollection = async (collectionId: string): Promise<string>
   export const unshareCollection = async (collectionId: string): Promise<void>
   export const getSharedCollection = async (shareToken: string): Promise<SharedCollectionData>
   ```

2. **Share Button Integration**
   - Add to collection header actions
   - Generate share_token using crypto.randomUUID()
   - Integrate with expo-sharing

3. **Deep Link Configuration**
   ```json
   // app.json
   "scheme": "dutchapp",
   "android": {
     "intentFilters": [...]
   },
   "ios": {
     "bundleIdentifier": "...",
     "associatedDomains": [...]
   }
   ```

### Phase 3: Import Flow Screens

1. **Share Preview Screen**

   ```typescript
   // src/app/share/[token].tsx
   ```

2. **Word Selection Screen**

   ```typescript
   // src/components/WordSelectionScreen.tsx
   ```

3. **Collection Picker Modal**
   ```typescript
   // src/components/CollectionPickerModal.tsx
   ```

### Phase 4: Import Logic

1. **Word Import Service**

   ```typescript
   // src/services/wordImportService.ts
   export const importWords = async (
     words: Word[],
     targetCollectionId: string,
     userId: string
   ): Promise<void>
   ```

2. **SRS Data Reset**
   - Copy word with fresh SRS values
   - Preserve analysis data (translations, examples, images)

---

## 📱 COMPONENTS TO CREATE

### New Components:

1. **ShareButton** - Collection sharing trigger
2. **SharePreviewScreen** - Preview shared collection
3. **WordSelectionList** - Checkbox list for word selection
4. **CollectionPickerModal** - Target collection selector
5. **ImportSuccessModal** - Import completion feedback

### Updated Components:

1. **Collection Header** - Add share button
2. **ApplicationStore** - Add sharing actions
3. **Collection Actions** - Update with sharing methods

---

## 🔗 DEEP LINKS ARCHITECTURE

### URL Patterns:

```
dutchapp://share/{uuid}           // Primary mobile deep link
```

### Future Web Support (Vercel):

```
https://your-domain.vercel.app/share/{uuid}  // Web fallback
```

### Expo Router Structure:

```
src/app/
├── share/
│   └── [token].tsx              // Share preview & import screen
├── collection/
│   └── [id].tsx                 // Existing collection view (updated)
```

---

## 🛡️ SECURITY CONSIDERATIONS

### UUID Token Benefits:

- **Cryptographically secure** (vs short codes)
- **No collision risk** (vs generated codes)
- **Standard Supabase approach**
- **Harder to guess** than sequential IDs

### Privacy Protection:

- Only `is_shared: true` collections accessible via share_token
- Shared collections readable only by authenticated users
- User data remains private (no cross-user data leakage)
- Import requires explicit user confirmation
- Original collection owner retains full control

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Database & Backend

- [ ] Create Supabase migration for collection sharing fields
- [ ] Update TypeScript types
- [ ] Add RLS policies for shared collections
- [ ] Test database changes

### Phase 2: Basic Sharing

- [ ] Implement collection sharing service
- [ ] Add share button to collection header
- [ ] Configure deep link handling
- [ ] Integrate Native Share Sheet (expo-sharing)
- [ ] Test share URL generation

### Phase 3: Import Flow

- [ ] Create share preview screen (`/share/[token]`)
- [ ] Implement collection data fetching by share_token
- [ ] Add "Add All" vs "Select Words" choice
- [ ] Create word selection interface
- [ ] Build collection picker modal

### Phase 4: Word Import

- [ ] Implement word copying logic
- [ ] Reset SRS data for imported words
- [ ] Handle duplicate word prevention
- [ ] Add import success feedback
- [ ] Test end-to-end sharing flow

### Phase 5: Polish & Testing

- [ ] Error handling for invalid/expired links
- [ ] Loading states for all screens
- [ ] Success/error toast notifications
- [ ] Cross-platform testing (iOS/Android)
- [ ] Edge case handling

---

## 🚀 FUTURE ENHANCEMENTS (Not in Scope)

### Web Version:

- Vercel deployment with same deep link structure
- Web-based collection preview and import
- Cross-platform URL compatibility

### Advanced Features:

- Share expiration dates
- Usage analytics for shared collections
- Collection updates sync to importers
- Social features (collection ratings, comments)

---

## 📊 SUCCESS METRICS

### Primary KPIs:

- Collection sharing adoption rate
- Import completion rate (preview → successful import)
- User engagement with shared collections
- Reduction in duplicate content creation

### Technical Metrics:

- Deep link success rate
- Share sheet interaction rate
- Import error rate
- Performance of share token lookups

---

_This simplified plan focuses on core sharing functionality with proven UX patterns, ready for immediate implementation._
