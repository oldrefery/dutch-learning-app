import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { createCluster } from './cluster.mjs'

const digest = 'a'.repeat(64)
const VERSION_1_0_0 = '1.0.0'
const REVIEWED_AT = '2026-09-11T10:00:00Z'
const PUBLISHED_AT = '2026-09-11T10:05:00Z'
const REVIEWED_DESCRIPTION = 'Reviewed fixture description'
const VISIBLE_PACK = 'official-visible'
const DRAFT_PACK = 'official-draft'
const ROLLOUT_PACK = 'official-rollout'
const HISTORY_PACK = 'official-history'
const manifest = (packId, version) =>
  JSON.stringify({
    schema_version: 1,
    pack_id: packId,
    version,
    title: 'Fixture pack',
    description: 'Fixture description',
    content_review: {
      status: 'approved',
      reviewed_by: 'test-reviewer',
      reviewed_at: REVIEWED_AT,
    },
    entries: [{ entry_id: 'fixture-1' }],
  }).replaceAll("'", "''")

const reviewedManifest = (
  packId,
  version,
  {
    description = REVIEWED_DESCRIPTION,
    entryCount = 1,
    title = 'Reviewed fixture',
  } = {}
) =>
  JSON.stringify({
    schema_version: 1,
    pack_id: packId,
    version,
    title,
    description,
    content_review: {
      status: 'approved',
      reviewed_by: 'test-reviewer',
      reviewed_at: REVIEWED_AT,
    },
    entries: Array.from({ length: entryCount }, (_, index) => ({
      entry_id: `fixture-${index + 1}`,
    })),
  }).replaceAll("'", "''")

const publicationSql = ({
  cefrLevel = 'A2',
  digestValue = digest,
  displayOrder = 2,
  entryCount = 1,
  manifestJson,
  publishedAt = PUBLISHED_AT,
  reviewedAt = REVIEWED_AT,
}) => `SELECT publish_official_content_pack(
  '${manifestJson}'::jsonb,
  '${digestValue}',
  '${cefrLevel}',
  ${displayOrder},
  ${entryCount},
  '${reviewedAt}',
  '${publishedAt}'
);`

const waitUntil = async predicate => {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (await predicate()) return
    await setTimeout(20)
  }
  throw new Error('Expected PostgreSQL publication lock was not reached')
}

const overlapPublications = async (first, second) => {
  const held = db.connect()
  const application = `official-content-${randomUUID()}`
  let waiting
  try {
    held.child.stdin.write(`SET statement_timeout = '10s'; BEGIN;
      ${first}
      \\echo PUBLICATION_HELD
    `)
    await waitUntil(() => held.output().includes('PUBLICATION_HELD'))
    waiting = db.sql(`SET application_name = '${application}'; ${second}`)
    void waiting.catch(() => {})
    await waitUntil(
      async () =>
        (await db.sql(`SELECT count(*) FROM pg_stat_activity
          WHERE application_name = '${application}'
            AND wait_event_type = 'Lock';`)) === '1'
    )
    held.child.stdin.end('COMMIT;\n')
    await held.completed
    return await waiting
  } finally {
    if (!held.child.stdin.writableEnded) held.child.stdin.end('ROLLBACK;\n')
    await held.completed.catch(() => {})
    await waiting?.catch(() => {})
  }
}

const insertPack = (packId, slug = packId) => `
  INSERT INTO official_content_packs (
    pack_id, slug, title, description, cefr_level, entry_count, display_order
  ) VALUES (
    '${packId}', '${slug}', 'Fixture pack', 'Fixture description', 'A1', 1, 1
  );`

const insertVersion = (packId, version, status = 'draft') => `
  INSERT INTO official_content_pack_versions (
    pack_id, version, title, description, cefr_level, entry_count,
    display_order, manifest, content_sha256, review_status,
    reviewed_at, published_at
  ) VALUES (
    '${packId}', '${version}', 'Fixture pack', 'Fixture description',
    'A1', 1, 1, '${manifest(packId, version)}'::jsonb,
    '${digest}', '${status}',
    ${status === 'draft' ? 'NULL' : `'${REVIEWED_AT}'`},
    ${status === 'draft' ? 'NULL' : `'${PUBLISHED_AT}'`}
  );`

const publishPack = (packId, version) => `
  UPDATE official_content_packs
  SET current_version = '${version}', published_at = '${PUBLISHED_AT}'
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
    ${insertPack(VISIBLE_PACK)}
    ${insertVersion(VISIBLE_PACK, VERSION_1_0_0, 'published')}
    ${publishPack(VISIBLE_PACK, VERSION_1_0_0)}
    ${insertPack(DRAFT_PACK)}
    ${insertVersion(DRAFT_PACK, VERSION_1_0_0)}
    ${publishPack(DRAFT_PACK, VERSION_1_0_0)}
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
        pack_id, version, title, description, cefr_level, entry_count,
        display_order, manifest, content_sha256, review_status
      ) VALUES (
        'official-validation', '1', 'Title', 'Description', 'A1', 1,
        1, '{}'::jsonb, 'invalid', 'draft'
      );`
    ),
    /23514/
  )

  await assert.rejects(
    db.sql(
      `INSERT INTO official_content_pack_versions (
        pack_id, version, title, description, cefr_level, entry_count,
        display_order, manifest, content_sha256, review_status
      ) VALUES (
        'official-validation', '1.0.0', 'Title', 'Description', 'A1', 1, 1,
        '${manifest('another-pack', '1.0.0')}'::jsonb,
        '${digest}', 'draft'
      );`
    ),
    /23514.*official_content_pack_versions_manifest_shape/s
  )
})

test('current version must belong to the same pack and can be rolled back by a trusted writer', async () => {
  await db.sql(`
    ${insertPack(ROLLOUT_PACK)}
    ${insertVersion(ROLLOUT_PACK, VERSION_1_0_0, 'published')}
    ${insertVersion(ROLLOUT_PACK, '1.1.0', 'published')}
    ${publishPack(ROLLOUT_PACK, '1.1.0')}
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

test('catalog entry count must match the selected manifest', async () => {
  await db.sql(`
    ${insertPack('official-count')}
    ${insertVersion('official-count', VERSION_1_0_0, 'published')}
  `)

  await assert.rejects(
    db.sql(`UPDATE official_content_packs
      SET entry_count = 2,
          current_version = '${VERSION_1_0_0}',
          published_at = '2026-09-11T10:05:00Z'
      WHERE pack_id = 'official-count';`),
    /Official content catalog entry count does not match the manifest/
  )
})

test('retired and draft versions stay hidden while older published versions remain downloadable', async () => {
  await db.sql(`
    ${insertPack(HISTORY_PACK)}
    ${insertVersion(HISTORY_PACK, VERSION_1_0_0, 'published')}
    ${insertVersion(HISTORY_PACK, '1.1.0', 'retired')}
    ${insertVersion(HISTORY_PACK, '1.2.0')}
    ${publishPack(HISTORY_PACK, VERSION_1_0_0)}
  `)

  assert.equal(
    await db.sql(`SET ROLE anon;
      SELECT version FROM official_content_pack_versions
      WHERE pack_id = 'official-history' ORDER BY version;`),
    '1.0.0'
  )
})

test('trusted publication is reviewed, atomic, idempotent, and client roles cannot call it', async () => {
  const publish = (manifestJson = reviewedManifest('official-rpc', '1.0.0')) =>
    publicationSql({ manifestJson })

  await db.sql(publish())
  await db.sql(publish())
  assert.equal(
    await db.sql(`SELECT pack_id || '@' || current_version || ':' || entry_count
      FROM official_content_packs WHERE pack_id = 'official-rpc';`),
    'official-rpc@1.0.0:1'
  )

  await assert.rejects(
    db.sql(
      publish(
        reviewedManifest('official-rpc', '1.0.0').replace(
          REVIEWED_DESCRIPTION,
          'Changed description'
        )
      )
    ),
    /Official content version already exists with different content/
  )
  assert.equal(
    await db.sql(`SELECT description FROM official_content_packs
      WHERE pack_id = 'official-rpc';`),
    REVIEWED_DESCRIPTION
  )

  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(
      db.sql(`SET ROLE ${role}; ${publish()}`),
      /42501.*permission denied for function publish_official_content_pack/s
    )
    await assert.rejects(
      db.sql(`SET ROLE ${role}; SELECT promote_official_content_pack_version(
        'official-rpc', '1.0.0', '${PUBLISHED_AT}'
      );`),
      /42501.*permission denied for function promote_official_content_pack_version/s
    )
    await assert.rejects(
      db.sql(`SET ROLE ${role}; SELECT withdraw_official_content_pack(
        'official-rpc'
      );`),
      /42501.*permission denied for function withdraw_official_content_pack/s
    )
  }
})

test('first-release withdrawal hides the pack and retires its immutable version', async () => {
  const packId = 'official-withdrawal'
  const secondPackId = 'official-withdrawal-second'
  const manifestJson = reviewedManifest(packId, '1.0.0')
  await db.sql(publicationSql({ manifestJson }))

  await db.sql(`SELECT withdraw_official_content_pack('${packId}');`)

  assert.equal(
    await db.sql(`SELECT current_version IS NULL AND published_at IS NULL
      FROM official_content_packs WHERE pack_id = '${packId}';`),
    't'
  )
  assert.equal(
    await db.sql(`SELECT review_status
      FROM official_content_pack_versions
      WHERE pack_id = '${packId}' AND version = '1.0.0';`),
    'retired'
  )
  for (const role of ['anon', 'authenticated']) {
    assert.equal(
      await db.sql(`SET ROLE ${role}; SELECT count(*)
        FROM official_content_packs WHERE pack_id = '${packId}';`),
      '0'
    )
    assert.equal(
      await db.sql(`SET ROLE ${role}; SELECT count(*)
        FROM official_content_pack_versions
        WHERE pack_id = '${packId}' AND version = '1.0.0';`),
      '0'
    )
  }

  await db.sql(`SELECT withdraw_official_content_pack('${packId}');`)
  await db.sql(
    publicationSql({ manifestJson: reviewedManifest(secondPackId, '1.0.0') })
  )
  await db.sql(`SELECT withdraw_official_content_pack(release.pack_id)
    FROM unnest(ARRAY[
      '${packId}', '${secondPackId}', 'official-not-published'
    ]::text[]) AS release(pack_id)
    JOIN official_content_packs AS packs
      ON packs.pack_id = release.pack_id
    WHERE packs.current_version = '1.0.0';`)
  assert.equal(
    await db.sql(`SELECT review_status
      FROM official_content_pack_versions
      WHERE pack_id = '${secondPackId}' AND version = '1.0.0';`),
    'retired'
  )
  await assert.rejects(
    db.sql(`SELECT promote_official_content_pack_version(
      '${packId}', '1.0.0', '${PUBLISHED_AT}'
    );`),
    /Published official content version is unavailable/
  )
})

test('publishing a new version can change entry count and rollback restores version metadata', async () => {
  const packId = 'official-size-change'
  const first = reviewedManifest(packId, '1.0.0', {
    description: 'One entry',
    entryCount: 1,
    title: 'Version one',
  })
  const second = reviewedManifest(packId, '2.0.0', {
    description: 'Two entries',
    entryCount: 2,
    title: 'Version two',
  })

  await db.sql(publicationSql({ entryCount: 1, manifestJson: first }))
  await db.sql(
    publicationSql({
      cefrLevel: 'B1',
      displayOrder: 7,
      entryCount: 2,
      manifestJson: second,
      publishedAt: '2026-09-11T11:05:00Z',
    })
  )
  assert.equal(
    await db.sql(`SELECT current_version || ':' || entry_count || ':' ||
      title || ':' || description || ':' || cefr_level || ':' || display_order
      FROM official_content_packs WHERE pack_id = '${packId}';`),
    '2.0.0:2:Version two:Two entries:B1:7'
  )

  await db.sql(`SELECT promote_official_content_pack_version(
    '${packId}', '1.0.0', '2026-09-11T12:00:00Z'
  );`)
  assert.equal(
    await db.sql(`SELECT current_version || ':' || entry_count || ':' ||
      title || ':' || description || ':' || cefr_level || ':' || display_order
      FROM official_content_packs WHERE pack_id = '${packId}';`),
    '1.0.0:1:Version one:One entry:A2:2'
  )
})

test('same-version retry preserves publication and catalog timestamps', async () => {
  const packId = 'official-idempotent'
  const manifestJson = reviewedManifest(packId, '1.0.0')
  await db.sql(publicationSql({ manifestJson }))
  const before = await db.sql(`SELECT row_to_json(snapshot) FROM (
    SELECT packs.published_at, packs.updated_at,
      versions.published_at AS version_published_at,
      versions.created_at AS version_created_at
    FROM official_content_packs packs
    JOIN official_content_pack_versions versions USING (pack_id)
    WHERE packs.pack_id = '${packId}'
  ) snapshot;`)
  await db.sql('SELECT pg_sleep(0.01);')
  await db.sql(
    publicationSql({
      manifestJson,
      publishedAt: '2026-09-11T13:00:00Z',
    })
  )
  const after = await db.sql(`SELECT row_to_json(snapshot) FROM (
    SELECT packs.published_at, packs.updated_at,
      versions.published_at AS version_published_at,
      versions.created_at AS version_created_at
    FROM official_content_packs packs
    JOIN official_content_pack_versions versions USING (pack_id)
    WHERE packs.pack_id = '${packId}'
  ) snapshot;`)
  assert.equal(after, before)
})

test('failed transaction leaves no partial version and an identical retry succeeds', async () => {
  const packId = 'official-interrupted'
  const manifestJson = reviewedManifest(packId, '1.0.0')
  const publish = publicationSql({ manifestJson })
  await db.sql(`BEGIN; ${publish} ROLLBACK;`)
  assert.equal(
    await db.sql(`SELECT count(*) FROM official_content_packs
      WHERE pack_id = '${packId}';`),
    '0'
  )
  await db.sql(publish)
  assert.equal(
    await db.sql(`SELECT current_version FROM official_content_packs
      WHERE pack_id = '${packId}';`),
    '1.0.0'
  )
})

test('competing publications serialize without mixed version metadata', async () => {
  const packId = 'official-concurrent'
  const first = publicationSql({
    entryCount: 1,
    manifestJson: reviewedManifest(packId, '1.0.0', {
      entryCount: 1,
      title: 'First version',
    }),
  })
  const second = publicationSql({
    cefrLevel: 'B2',
    displayOrder: 8,
    entryCount: 2,
    manifestJson: reviewedManifest(packId, '2.0.0', {
      entryCount: 2,
      title: 'Second version',
    }),
    publishedAt: '2026-09-11T11:05:00Z',
  })
  await overlapPublications(first, second)
  assert.equal(
    await db.sql(`SELECT current_version || ':' || entry_count || ':' ||
      title || ':' || cefr_level || ':' || display_order
      FROM official_content_packs WHERE pack_id = '${packId}';`),
    '2.0.0:2:Second version:B2:8'
  )
  assert.equal(
    await db.sql(`SELECT count(*) FROM official_content_pack_versions
      WHERE pack_id = '${packId}';`),
    '2'
  )
})

test('publication review timestamp must match the approved manifest', async () => {
  const manifestJson = reviewedManifest('official-review-time', '1.0.0')
  await assert.rejects(
    db.sql(
      publicationSql({
        manifestJson,
        reviewedAt: '2026-09-11T09:00:00Z',
      })
    ),
    /review timestamp does not match/
  )
  await assert.rejects(
    db.sql(
      publicationSql({
        manifestJson: manifestJson.replace(REVIEWED_AT, 'not-a-timestamp'),
      })
    ),
    /review timestamp is invalid/
  )
  await assert.rejects(
    db.sql(
      publicationSql({
        manifestJson: manifestJson.replace(
          `"reviewed_at":"${REVIEWED_AT}"`,
          '"reviewed_at":null'
        ),
      })
    ),
    /must complete editorial review/
  )
})

test('published state can only become retired and retired versions cannot be revived', async () => {
  await assert.rejects(
    db.sql(`UPDATE official_content_pack_versions
      SET review_status = 'draft', published_at = NULL
      WHERE pack_id = '${VISIBLE_PACK}' AND version = '${VERSION_1_0_0}';`),
    /Official content version state transition is not allowed/
  )
  await db.sql(`UPDATE official_content_pack_versions
    SET review_status = 'retired'
    WHERE pack_id = '${VISIBLE_PACK}' AND version = '${VERSION_1_0_0}';`)
  await assert.rejects(
    db.sql(`SELECT promote_official_content_pack_version(
      '${VISIBLE_PACK}', '${VERSION_1_0_0}', '${PUBLISHED_AT}'
    );`),
    /Published official content version is unavailable/
  )
  await assert.rejects(
    db.sql(`UPDATE official_content_pack_versions
      SET review_status = 'published'
      WHERE pack_id = '${VISIBLE_PACK}' AND version = '${VERSION_1_0_0}';`),
    /Official content version state transition is not allowed/
  )
})
