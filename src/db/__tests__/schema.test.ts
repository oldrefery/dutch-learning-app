import {
  MIGRATION_V5_TOMBSTONE_INDEXES,
  MIGRATION_V6_SYNC_TIMESTAMP_COLUMNS,
  MIGRATION_V7_REVIEW_EVENTS,
  SQL_SCHEMA,
} from '../schema'
import fs from 'node:fs'
import path from 'node:path'

const ACTIVE_WORD_PREDICATE = 'WHERE deleted_at IS NULL'

describe('delete tombstone schema', () => {
  it('should include deleted_at on fresh local tables', () => {
    const deletedAtColumns = SQL_SCHEMA.match(/deleted_at TEXT/g) ?? []

    expect(deletedAtColumns).toHaveLength(2)
  })

  it('should enforce semantic uniqueness only for active words', () => {
    expect(MIGRATION_V5_TOMBSTONE_INDEXES).toContain(ACTIVE_WORD_PREDICATE)
    expect(MIGRATION_V5_TOMBSTONE_INDEXES).toContain(
      'DROP INDEX IF EXISTS idx_words_semantic_key'
    )
  })

  it('should keep the remote anti-resurrection safeguards', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260725150000_add_word_delete_tombstones.sql'
    )
    const migration = fs.readFileSync(migrationPath, 'utf8')

    expect(migration).toContain('preserve_word_tombstone_on_update')
    expect(migration).toContain(
      'OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL'
    )
    expect(migration).toContain(ACTIVE_WORD_PREDICATE)
  })
})

describe('review event history schema', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260829100000_create_review_events.sql'
  )
  const migration = fs.readFileSync(migrationPath, 'utf8')

  it('creates bounded local event data without card content', () => {
    expect(MIGRATION_V7_REVIEW_EVENTS).toContain(
      'CREATE TABLE IF NOT EXISTS review_events'
    )
    expect(MIGRATION_V7_REVIEW_EVENTS).toContain('response_time_ms <= 3600000')
    expect(MIGRATION_V7_REVIEW_EVENTS).toContain(
      'FOREIGN KEY (word_id) REFERENCES words(word_id) ON DELETE CASCADE'
    )
    expect(MIGRATION_V7_REVIEW_EVENTS).not.toMatch(
      /dutch_lemma|translations|examples/
    )
  })

  it('uses deterministic local indexes and removes history on tombstones', () => {
    expect(MIGRATION_V7_REVIEW_EVENTS).toContain(
      'ON review_events(user_id, created_at, event_id)'
    )
    expect(MIGRATION_V7_REVIEW_EVENTS).toContain(
      'delete_review_events_for_tombstoned_word'
    )
  })

  it('enforces owner-only append semantics remotely', () => {
    expect(migration).toContain('CREATE TABLE public.review_events')
    expect(migration).toContain(
      'ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY'
    )
    expect(migration).toContain('Users can view their own review events')
    expect(migration).toContain('Users can create their own review events')
    expect(migration).toContain('Users can retry their own review events')
    expect(migration).not.toContain('FOR DELETE')
    expect(migration).toContain('review_events rows are immutable')
  })

  it('cascades hard and soft parent deletion', () => {
    expect(migration).toContain('REFERENCES public.users(id) ON DELETE CASCADE')
    expect(migration).toContain(
      'REFERENCES public.words(word_id) ON DELETE CASCADE'
    )
    expect(migration).toContain('delete_review_events_on_word_tombstone')
  })
})

describe('local sync timestamp schema', () => {
  it('keeps sync timestamps separate on every synchronized entity', () => {
    expect(SQL_SCHEMA.match(/last_sync_attempt_at TEXT/g)).toHaveLength(3)
    expect(SQL_SCHEMA.match(/synced_at TEXT/g)).toHaveLength(3)
  })

  it('provides an idempotent migration entry for every sync timestamp', () => {
    expect(MIGRATION_V6_SYNC_TIMESTAMP_COLUMNS).toHaveLength(6)
    expect(
      MIGRATION_V6_SYNC_TIMESTAMP_COLUMNS.map(column => column.columnName)
    ).toEqual([
      'collections.last_sync_attempt_at',
      'collections.synced_at',
      'words.last_sync_attempt_at',
      'words.synced_at',
      'user_progress.last_sync_attempt_at',
      'user_progress.synced_at',
    ])
  })
})

describe('remote semantic uniqueness schema', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260725180000_align_word_semantic_case_normalization.sql'
  )
  const migration = fs.readFileSync(migrationPath, 'utf8')

  it('should enforce case-insensitive uniqueness for active words', () => {
    expect(migration).toContain('lower(dutch_lemma)')
    expect(migration).toContain(ACTIVE_WORD_PREDICATE)
    expect(migration).toContain('CREATE UNIQUE INDEX idx_words_semantic_unique')
  })

  it('should keep shared import conflict inference aligned with the index', () => {
    expect(migration).toContain('ON CONFLICT (')
    expect(migration).toContain('lower(w.dutch_lemma) = v_normalized_lemma')
    expect(migration.match(/lower\(dutch_lemma\)/g)).toHaveLength(3)
  })

  it('should block destructive automatic resolution of existing collisions', () => {
    expect(migration).toContain('HAVING count(*) > 1')
    expect(migration).toContain(
      'active semantic key collision(s) require manual resolution'
    )
  })
})

describe('remote user progress schema', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260725170000_create_user_progress.sql'
  )
  const migration = fs.readFileSync(migrationPath, 'utf8')

  it('should create the complete progress sync stream', () => {
    expect(migration).toContain('CREATE TABLE public.user_progress')
    expect(migration).toContain(
      'progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid()'
    )
    expect(migration).not.toContain('DEFAULT uuid_generate_v4()')
    expect(migration).toContain('CREATE INDEX idx_user_progress_sync_cursor')
    expect(migration).toContain(
      'ON public.user_progress(user_id, updated_at, progress_id)'
    )
    expect(migration).toContain('deleted_at TIMESTAMPTZ')
  })

  it('should define article before the semantic uniqueness migration', () => {
    const missingFeaturesMigration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'supabase/migrations/20250908082122_add_missing_word_features.sql'
      ),
      'utf8'
    )

    expect(missingFeaturesMigration).toContain(
      'ADD COLUMN IF NOT EXISTS article TEXT'
    )
  })

  it('should restrict every operation to the authenticated owner', () => {
    expect(migration).toContain(
      'ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY'
    )
    expect(migration.match(/TO authenticated/g)).toHaveLength(4)
    expect(migration.match(/\(SELECT auth\.uid\(\)\) = user_id/g)).toHaveLength(
      5
    )
  })

  it('should manage updated timestamps and prevent resurrection', () => {
    expect(migration).toContain('handle_user_progress_updated_at')
    expect(migration).toContain('extensions.moddatetime(updated_at)')
    expect(migration).toContain('preserve_user_progress_tombstone_on_update')
    expect(migration).toContain(
      'OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL'
    )
  })
})
