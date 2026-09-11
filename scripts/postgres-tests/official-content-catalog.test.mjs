import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'

const digest = 'a'.repeat(64)
const manifest = (packId, version) =>
  JSON.stringify({
    schema_version: 1,
    pack_id: packId,
    version,
    entries: [{ entry_id: 'fixture-1' }],
  }).replaceAll("'", "''")

const insertPack = (packId, slug = packId) => `
  INSERT INTO official_content_packs (
    pack_id, slug, title, description, cefr_level, display_order
  ) VALUES (
    '${packId}', '${slug}', 'Fixture pack', 'Fixture description', 'A1', 1
  );`

const insertVersion = (packId, version, status = 'draft') => `
  INSERT INTO official_content_pack_versions (
    pack_id, version, manifest, content_sha256, review_status,
    reviewed_at, published_at
  ) VALUES (
    '${packId}', '${version}', '${manifest(packId, version)}'::jsonb,
    '${digest}', '${status}',
    ${status === 'draft' ? 'NULL' : "'2026-09-11T10:00:00Z'"},
    ${status === 'draft' ? 'NULL' : "'2026-09-11T10:05:00Z'"}
  );`

const publishPack = (packId, version) => `
  UPDATE official_content_packs
  SET current_version = '${version}', published_at = '2026-09-11T10:05:00Z'
  WHERE pack_id = '${packId}';`

let db
before(async () => {
  db = await createCluster()
})
after(async () => {
  await db?.close()
})

test('anonymous and authenticated clients see only published catalog content', async () => {
  await db.sql(`
    ${insertPack('official-visible')}
    ${insertVersion('official-visible', '1.0.0', 'published')}
    ${publishPack('official-visible', '1.0.0')}
    ${insertPack('official-draft')}
    ${insertVersion('official-draft', '1.0.0')}
    ${publishPack('official-draft', '1.0.0')}
  `)

  for (const role of ['anon', 'authenticated']) {
    assert.equal(
      await db.sql(
        `SET ROLE ${role}; SELECT pack_id FROM official_content_packs ORDER BY pack_id;`
      ),
      'official-visible'
    )
    assert.equal(
      await db.sql(
        `SET ROLE ${role}; SELECT pack_id || '@' || version FROM official_content_pack_versions ORDER BY pack_id;`
      ),
      'official-visible@1.0.0'
    )
  }
})

test('published manifest payloads are immutable even to a trusted writer', async () => {
  await assert.rejects(
    db.sql(`UPDATE official_content_pack_versions
      SET manifest = jsonb_set(manifest, '{entries,0,entry_id}', '"changed"')
      WHERE pack_id = 'official-visible' AND version = '1.0.0';`),
    /Published official content versions are immutable/
  )
  await assert.rejects(
    db.sql(`DELETE FROM official_content_pack_versions
      WHERE pack_id = 'official-visible' AND version = '1.0.0';`),
    /Published official content versions cannot be deleted/
  )
})

test('client roles cannot create, update, or delete official content', async () => {
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(
      db.sql(`SET ROLE ${role}; ${insertPack(`client-${role}`)}`),
      /42501.*permission denied for table official_content_packs/s
    )
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; UPDATE official_content_packs SET title = 'Changed';`
      ),
      /42501.*permission denied for table official_content_packs/s
    )
    await assert.rejects(
      db.sql(`SET ROLE ${role}; DELETE FROM official_content_pack_versions;`),
      /42501.*permission denied for table official_content_pack_versions/s
    )
  }
})

test('catalog constraints reject malformed or inconsistent manifests', async () => {
  await db.sql(insertPack('official-validation'))

  await assert.rejects(
    db.sql(
      `INSERT INTO official_content_pack_versions (
        pack_id, version, manifest, content_sha256, review_status
      ) VALUES (
        'official-validation', '1', '{}'::jsonb, 'invalid', 'draft'
      );`
    ),
    /23514/
  )

  await assert.rejects(
    db.sql(
      `INSERT INTO official_content_pack_versions (
        pack_id, version, manifest, content_sha256, review_status
      ) VALUES (
        'official-validation', '1.0.0',
        '${manifest('another-pack', '1.0.0')}'::jsonb,
        '${digest}', 'draft'
      );`
    ),
    /23514.*official_content_pack_versions_manifest_shape/s
  )
})

test('current version must belong to the same pack and can be rolled back by a trusted writer', async () => {
  await db.sql(`
    ${insertPack('official-rollout')}
    ${insertVersion('official-rollout', '1.0.0', 'published')}
    ${insertVersion('official-rollout', '1.1.0', 'published')}
    ${publishPack('official-rollout', '1.1.0')}
  `)

  assert.equal(
    await db.sql(
      "SELECT current_version FROM official_content_packs WHERE pack_id = 'official-rollout';"
    ),
    '1.1.0'
  )
  await db.sql(
    "UPDATE official_content_packs SET current_version = '1.0.0' WHERE pack_id = 'official-rollout';"
  )
  assert.equal(
    await db.sql(
      "SELECT current_version FROM official_content_packs WHERE pack_id = 'official-rollout';"
    ),
    '1.0.0'
  )

  await assert.rejects(
    db.sql(
      "UPDATE official_content_packs SET current_version = '9.9.9' WHERE pack_id = 'official-rollout';"
    ),
    /23503.*official_content_packs_current_version/s
  )
})

test('retired and draft versions stay hidden while older published versions remain downloadable', async () => {
  await db.sql(`
    ${insertPack('official-history')}
    ${insertVersion('official-history', '1.0.0', 'published')}
    ${insertVersion('official-history', '1.1.0', 'retired')}
    ${insertVersion('official-history', '1.2.0')}
    ${publishPack('official-history', '1.0.0')}
  `)

  assert.equal(
    await db.sql(`SET ROLE anon;
      SELECT version FROM official_content_pack_versions
      WHERE pack_id = 'official-history' ORDER BY version;`),
    '1.0.0'
  )
})
