import { MIGRATION_V5_TOMBSTONE_INDEXES, SQL_SCHEMA } from '../schema'
import fs from 'node:fs'
import path from 'node:path'

describe('delete tombstone schema', () => {
  it('should include deleted_at on fresh local tables', () => {
    const deletedAtColumns = SQL_SCHEMA.match(/deleted_at TEXT/g) ?? []

    expect(deletedAtColumns).toHaveLength(2)
  })

  it('should enforce semantic uniqueness only for active words', () => {
    expect(MIGRATION_V5_TOMBSTONE_INDEXES).toContain('WHERE deleted_at IS NULL')
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
    expect(migration).toContain('WHERE deleted_at IS NULL')
  })
})
