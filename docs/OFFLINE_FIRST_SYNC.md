# Offline-First Sync Implementation

## Overview

This document describes the offline-first synchronization system for the Dutch Learning App. The app now supports full offline functionality with automatic synchronization when network connection is restored.

## Architecture

### Layers

1. **Local Database Layer** (`src/db/`)
   - SQLite-based local storage
   - Mirrors Supabase schema structure
   - Tracks sync status of each record

2. **Sync Manager** (`src/services/syncManager.ts`)
   - Orchestrates bi-directional synchronization
   - Pulls new/updated words from Supabase
   - Pushes local changes (progress, word updates) to Supabase
   - Handles conflict resolution (last-write-wins)

3. **Network Utilities** (`src/utils/network.ts`)
   - Network connection monitoring
   - Manages last sync timestamp

4. **Hooks** (`src/hooks/`)
   - `useSyncManager`: Manages sync lifecycle
   - `useLocalWords`: Read/write interface for words
   - `useLocalProgress`: Read/write interface for progress

## Database Schema

### Local Tables

#### `words`

Mirrors Supabase `words` table + sync metadata:

- All standard word fields (dutch_lemma, translations, examples, etc.)
- SRS fields (interval_days, repetition_count, easiness_factor, etc.)
- `sync_status`: 'synced' | 'pending' | 'error' | 'conflict'
- `updated_at`: Timestamp for sync ordering

#### `user_progress`

Local cache of user progress:

- `progress_id`, `user_id`, `word_id`
- `status`, `reviewed_count`, `last_reviewed_at`
- `sync_status`: Tracks if changes need to be sent to Supabase
- `updated_at`: For conflict resolution

#### `sync_metadata`

Stores system metadata:

- `last_sync_timestamp`: When the last successful sync occurred
- Schema versioning for migrations

## Usage

### 1. Initialize Sync Manager in Root Component

In your root layout (e.g., `src/app/_layout.tsx`):

```tsx
import { useSyncManager } from '@/hooks/useSyncManager';

export default function RootLayout() {
  // Initialize sync system on app startup
  useSyncManager({
    autoSyncOnMount: true,        // Sync when app starts
    autoSyncOnFocus: true,         // Sync when app comes to foreground
    autoSyncOnNetworkChange: true, // Sync when network reconnects
    syncIntervalMs: 5 * 60 * 1000, // Sync every 5 minutes
  });

  return (
    // Your layout component
  );
}
```

### 2. Use Local Words in Components

```tsx
import { useLocalWords } from '@/hooks/useLocalWords';

export function WordListScreen() {
  const { words, isLoading, fetchWords, updateWordProgress } = useLocalWords();

  const handleReview = async (wordId: string, progress: Partial<Word>) => {
    try {
      // This updates local SQLite immediately
      // Changes will be marked as 'pending' and synced when online
      await updateWordProgress(wordId, progress);
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <FlatList
      data={words}
      renderItem={({ item }) => (
        <WordCard
          word={item}
          onReview={() => handleReview(item.word_id, {...})}
        />
      )}
    />
  );
}
```

### 3. Monitor Sync Status

```tsx
import { useSyncManager } from '@/hooks/useSyncManager'

export function SyncIndicator() {
  const { syncResult, isSyncing } = useSyncManager()

  return (
    <View>
      {isSyncing && <Text>Syncing...</Text>}
      {syncResult?.success && (
        <Text>
          Synced {syncResult.wordsSynced} words, {syncResult.progressSynced}{' '}
          progress
        </Text>
      )}
      {syncResult?.error && <Text>Sync failed: {syncResult.error}</Text>}
    </View>
  )
}
```

## Sync Flow

### On App Startup (or Focus)

```
1. Initialize local SQLite database
2. Check network connection
3. If online:
   a. Pull new/updated words from Supabase (since last_sync_timestamp)
   b. Save to local SQLite
   c. Push pending progress records to Supabase
   d. Push pending word updates to Supabase
   e. Mark records as 'synced'
   f. Update last_sync_timestamp
4. Set up periodic sync (every 5 minutes by default)
5. Subscribe to network state changes
```

### When Going Offline

```
1. All read operations use local SQLite
2. All write operations (progress updates, etc.):
   - Update local SQLite immediately
   - Mark records as 'pending'
   - UI updates instantly (optimistic updates)
```

### When Network Reconnects

```
1. Check for pending changes in local SQLite
2. Push pending records to Supabase
3. Pull new words from Supabase
4. Resolve conflicts (last-write-wins by updated_at)
5. Mark all as 'synced'
6. Notify UI of sync completion
```

## Sync Status Values

- **synced**: Record is up-to-date with Supabase
- **pending**: Local changes not yet sent to Supabase
- **error**: Last sync attempt failed (will retry)
- **conflict**: Detected during sync (resolved by last-write-wins)

## Key Design Decisions

### 1. Last-Write-Wins Conflict Resolution

When the same record is updated locally and remotely, the version with the latest `updated_at` timestamp wins. This is simple and works well for word review progress.

### 2. Optimistic Updates

When user makes a change (e.g., mark word as reviewed), UI updates immediately using local data. Sync happens in background.

### 3. Lazy Sync

Sync doesn't happen on every change. Instead:

- On app startup
- On app focus
- On network reconnection
- Every 5 minutes (if online)

This reduces battery drain and network requests while keeping data reasonably fresh.

### 4. No Soft Deletes

Currently, we don't use soft deletes (is_deleted flag). Users can only view their synced words. If you need restore functionality, consider adding this.

## TypeScript Types

### LocalWord

Extends `Word` with sync metadata:

```typescript
interface LocalWord extends Word {
  sync_status: SyncStatus
}
```

### UserProgress

Local progress tracking:

```typescript
interface UserProgress {
  progress_id: string
  user_id: string
  word_id: string
  status: string
  reviewed_count: number
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
  sync_status: SyncStatus
}
```

## Database Migrations

To add new fields to the schema:

1. Update `src/db/schema.ts` SQL_SCHEMA
2. Increment `SCHEMA_VERSION` in `src/db/initDB.ts`
3. The database will automatically run migrations on next startup

Example:

```typescript
// schema.ts
export const SQL_SCHEMA = `
  ...
  ALTER TABLE words ADD COLUMN new_field TEXT;
  ...
`

// initDB.ts
const SCHEMA_VERSION = 2 // was 1
```

## Performance Considerations

### Indexes

The schema includes indexes on frequently queried columns:

- `user_id` (filtering by user)
- `updated_at` (finding recent changes)
- `sync_status` (finding pending changes)

### Batch Operations

- Inserts/updates use prepared statements with batch execution
- Network requests use `upsert` to minimize round-trips

### Memory

- Don't load all words at once in large collections
- Use pagination or filtering with `getWordsByCollectionId()`

## Debugging

### Check Sync Status

```typescript
import { syncManager } from '@/services/syncManager'

// Manual sync trigger
const result = await syncManager.performSync(userId)
console.log('Sync result:', result)
```

### Reset Database

```typescript
import { resetDatabase } from '@/db/initDB'

// Warning: Deletes all local data
await resetDatabase()
```

### View Local Data

```typescript
import { wordRepository } from '@/db/wordRepository'
import { progressRepository } from '@/db/progressRepository'

const words = await wordRepository.getWordsByUserId(userId)
const progress = await progressRepository.getProgressByUserId(userId)

console.log('Local words:', words)
console.log('Local progress:', progress)
```

## Future Improvements

1. **Soft Deletes**: Add `is_deleted` flag to support restore functionality
2. **Selective Sync**: Allow users to choose which collections to sync
3. **Compression**: Compress payload for large datasets
4. **Delta Sync**: Only sync changed fields instead of full records
5. **P2P Sync**: Sync between devices using local network
6. **Realtime**: Use Supabase Realtime (when stable network available)
