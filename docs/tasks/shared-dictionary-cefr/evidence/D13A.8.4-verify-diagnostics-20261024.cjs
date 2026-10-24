const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict'),
  crypto = require('crypto'),
  cp = require('child_process')
const { TraceMap, decodedMappings } = require('@jridgewell/trace-mapping')
const root = path.resolve(__dirname, '../../../..')
// Metro composition resolves the last mapping at duplicate generated columns.
// Use an independent VLQ decoder plus an explicit greatest-lower-bound search.
function locate(map, position) {
  const entries = decodedMappings(map)[position.line - 1] ?? []
  let low = 0,
    high = entries.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (entries[mid][0] <= position.column) low = mid + 1
    else high = mid
  }
  const segment = entries[low - 1]
  if (!segment || segment.length < 4)
    return { source: null, line: null, column: null }
  return {
    source: map.resolvedSources[segment[1]],
    line: segment[2] + 1,
    column: segment[3],
  }
}
function verifyChain(platform, directory, overrides = {}) {
  const name = platform === 'ios' ? 'main.jsbundle' : 'index.android.bundle'
  const dir = path.join(directory, platform)
  const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const packager = overrides.packager ?? read(name + '.map')
  const compiler = overrides.compiler ?? read('recompiled.hbc.map')
  const composed = overrides.composed ?? read(name + '.composed.map')
  const source = fs.readFileSync(
    path.join(dir, platform === 'ios' ? name : 'index.android.bundle.exact.js'),
    'utf8'
  )
  const id = source.match(/\/\/# debugId=([a-f0-9-]+)/)?.[1]
  assert.ok(id, 'Missing runtime Debug ID')
  assert.equal(
    packager.debugId ?? packager.debug_id,
    id,
    'Wrong packager Debug ID'
  )
  assert.equal(composed.debugId, id, 'Wrong composed Debug ID')
  assert.equal(composed.debug_id, id, 'Missing compatible Debug ID')
  assert.deepEqual(
    composed.x_hermes_function_offsets,
    compiler.x_hermes_function_offsets,
    'Wrong Hermes offsets'
  )
  const p = new TraceMap(packager),
    c = new TraceMap(composed),
    h = new TraceMap(compiler)
  const decoded = decodedMappings(new TraceMap(compiler))
  let total = 0
  for (const line of decoded) for (const s of line) if (s.length >= 4) total++
  const stride = Math.max(1, Math.floor(total / 5000))
  let ordinal = 0,
    checked = 0,
    app = 0,
    unmapped = 0
  const matchedSources = new Set()
  for (let line = 0; line < decoded.length; line++)
    for (const seg of decoded[line]) {
      if (seg.length < 4) continue
      if (ordinal++ % stride !== 0) continue
      const intermediate = locate(h, { line: line + 1, column: seg[0] })
      const expected =
        intermediate.line == null
          ? { source: null, line: null, column: null }
          : locate(p, { line: intermediate.line, column: intermediate.column })
      const actual = locate(c, { line: line + 1, column: seg[0] })
      assert.equal(actual.source, expected.source, 'Source chain mismatch')
      assert.equal(actual.line, expected.line, 'Line chain mismatch')
      assert.equal(actual.column, expected.column, 'Column chain mismatch')
      checked++
      if (actual.source?.includes('apps/mobile/src/')) {
        app++
        matchedSources.add(actual.source)
      }
      if (actual.source == null) unmapped++
    }
  assert.ok(
    checked >= 5000 && app >= 100 && matchedSources.size >= 100,
    'Insufficient address coverage'
  )
  let local = 0
  for (let i = 0; i < packager.sources.length; i++) {
    const s = packager.sources[i]
    if (
      !s.includes('apps/mobile/src/') ||
      s.includes('?') ||
      !/[.][jt]sx?$/.test(s)
    )
      continue
    const rel = s.slice(s.indexOf('apps/mobile/src/'))
    assert.ok(!rel.includes('..'), 'Unsafe source path')
    const f = path.join(root, rel)
    if (!fs.existsSync(f)) continue
    assert.ok(
      packager.sourcesContent[i] === fs.readFileSync(f, 'utf8'),
      'Source content differs: ' + rel
    )
    local++
  }
  assert.ok(local >= 300, 'Insufficient application sources')
  return {
    platform,
    debug_id: id,
    compiler_mappings: total,
    checked_addresses: checked,
    application_addresses: app,
    application_sources_sampled: matchedSources.size,
    application_sources_byte_verified: local,
    unmapped_addresses: unmapped,
  }
}

function sha(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}
function repoFile(name) {
  assert.equal(typeof name, 'string')
  assert.ok(
    !path.isAbsolute(name) && !name.split(/[\\/]/).includes('..'),
    'Unsafe input path'
  )
  const result = path.join(root, name)
  assert.ok(
    fs.lstatSync(result).isFile() && !fs.lstatSync(result).isSymbolicLink(),
    'Not a regular input'
  )
  assert.ok(
    fs.realpathSync(result).startsWith(root + path.sep),
    'Input leaves repository'
  )
  return result
}
function verifySupplement(packet, execute = false) {
  assert.equal(packet.packet_type, 'D13A.8.4-diagnostics-and-backend-addendum')
  assert.deepEqual(packet.authority, {
    preparation_only: true,
    publication: false,
    production_writes: false,
    account_rows_read: false,
    paid_requests: 0,
    real_link_ceiling: 0,
  })
  assert.equal(packet.ready_for_execution, false)
  assert.deepEqual(packet.authorized_commands, [])
  assert.equal(
    packet.base_packet.sha256,
    '665722a50bd0d1be91db1c9d3e7131653cf097042762cee997450530dcf73c6e'
  )
  assert.equal(
    sha(fs.readFileSync(repoFile(packet.base_packet.path))),
    packet.base_packet.sha256
  )
  assert.equal(
    packet.base_bundle.sha256,
    'ab682bc7a2850fdff2b1f88d0b32639041eb4f7d6f55a510f971e717dd30dc1f'
  )
  assert.equal(
    sha(fs.readFileSync(repoFile(packet.base_bundle.path))),
    packet.base_bundle.sha256
  )
  assert.equal(
    packet.base_verifier,
    'docs/tasks/shared-dictionary-cefr/evidence/D13A.8.4-verify-review-20261024.py'
  )
  assert.deepEqual(packet.budget, {
    new_provider_requests: 0,
    unknown_held_usd: '0.56',
  })
  assert.deepEqual(packet.supersedes_only, [
    'R04 exact JavaScript maps not retained',
    'R05 migration/function presence not yet observed',
  ])
  assert.deepEqual(packet.open_conditions, [
    'compatible native rollback',
    'exact store delivery and eligibility',
    'authenticated/offline/sync/5000-word qualification',
    'baseline schema/policy/gateway/runtime verification',
    'fresh protected backup and isolated restore',
    'live delta and cohort queues',
    'exact coordinated rehearsal',
    'scoped execution approval',
  ])
  const base = JSON.parse(fs.readFileSync(repoFile(packet.base_packet.path)))
  assert.equal(
    cp.spawnSync(
      'python3',
      [repoFile(packet.base_verifier), repoFile(packet.base_packet.path)],
      { cwd: root, encoding: 'utf8' }
    ).status,
    0,
    'Base review failed'
  )
  for (const [name, hash] of Object.entries(packet.files_sha256))
    assert.equal(
      sha(fs.readFileSync(repoFile(name))),
      hash,
      'Input digest mismatch: ' + name
    )
  assert.deepEqual(Object.keys(packet.maps).sort(), ['android', 'ios'])
  const trusted = {
    ios: '7d7b496d7ae12d31012d6c9625f1021cb9cdf3c47a3dec1511b560d8344218c4',
    android: '787063e2eec684b16246ad35acdefb39be34ad849f9e6086054a7669d1041abf',
  }
  const results = []
  for (const platform of ['ios', 'android']) {
    const m = packet.maps[platform]
    assert.equal(
      m.native_entry,
      platform === 'ios'
        ? 'Payload/DeWoordenaar.app/main.jsbundle'
        : 'base/assets/index.android.bundle'
    )
    for (const key of [
      'source',
      'recompiled',
      'packager_map',
      'compiler_map',
      'composed_map',
    ])
      assert.ok(packet.files_sha256[m[key]], 'Unpinned map dependency')
    assert.equal(m.bytecode_sha256, trusted[platform])
    const nativePath = repoFile(base.native[platform].artifact)
    const extracted = cp.spawnSync(
      'python3',
      [
        '-c',
        'import zipfile,sys;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',
        nativePath,
        m.native_entry,
      ],
      { encoding: null, maxBuffer: 20000000 }
    )
    assert.equal(extracted.status, 0, 'Cannot read native bytecode')
    const actual = extracted.stdout,
      rebuilt = fs.readFileSync(repoFile(m.recompiled)),
      source = fs.readFileSync(repoFile(m.source))
    assert.equal(sha(actual), trusted[platform])
    assert.ok(actual.equals(rebuilt), 'Recompiled bytecode differs')
    assert.equal(actual.readUInt32LE(8), 98, 'Wrong Hermes bytecode version')
    assert.ok(
      actual
        .subarray(12, 32)
        .equals(crypto.createHash('sha1').update(source).digest()),
      'Hermes source hash differs'
    )
    const result = verifyChain(
      platform,
      path.dirname(path.dirname(repoFile(m.source)))
    )
    assert.deepEqual(result, m.chain_review, 'Map chain receipt differs')
    results.push(result)
  }
  const backend = JSON.parse(
    fs.readFileSync(repoFile(packet.backend_metadata.path))
  )
  assert.equal(
    packet.backend_metadata.sha256,
    sha(fs.readFileSync(repoFile(packet.backend_metadata.path)))
  )
  assert.equal(backend.project_ref, base.targets.supabase_project_ref)
  assert.equal(backend.status, 'metadata_observed')
  assert.equal(backend.account_rows_read, false)
  assert.equal(backend.production_writes, false)
  assert.equal(backend.provider_requests, 0)
  assert.equal(backend.queries.identity.rows[0].transaction_read_only, 'on')
  assert.ok(Object.values(backend.queries).every(q => q.read_only_requested))
  const ledger = new Set(backend.queries.ledger.rows.map(x => x.version))
  assert.equal(ledger.size, 52)
  assert.equal(backend.candidate_migrations.length, 14)
  for (const migration of base.migrations)
    assert.ok(
      !ledger.has(path.basename(migration.path).split('_')[0]),
      'Expected migration absence changed'
    )
  const slugs = new Set(backend.edge_functions.map(f => f.slug))
  assert.ok(
    !slugs.has('dictionary-analysis') && !slugs.has('dictionary-creation'),
    'Expected deployment absence changed'
  )
  assert.equal(packet.backend_metadata.fresh_backup, false)
  assert.equal(packet.backend_metadata.live_policy_qualification, false)
  assert.equal(packet.source_maps_uploaded, false)
  assert.equal(packet.full_device_qualification, false)
  assert.deepEqual(packet.remaining, {
    stage_complete: 3,
    stage_total: 6,
    stage_steps_remaining: 3,
    other_major_milestones: 6,
  })
  assert.equal(execute, false, 'Execution is forbidden')
  return {
    status: 'addendum_integrity_verified',
    javascript_maps: 'exact_bytecode_and_address_chain_verified',
    map_addresses_checked: results.reduce((n, r) => n + r.checked_addresses, 0),
    backend_candidate_migrations_absent: 14,
    execution_authorized: false,
  }
}
module.exports = { verifyChain, verifySupplement }
if (require.main === module) {
  try {
    const packet = JSON.parse(fs.readFileSync(process.argv[2]))
    console.log(
      JSON.stringify(
        verifySupplement(packet, process.argv.includes('--check-execution')),
        null,
        2
      )
    )
  } catch (error) {
    console.error('Verification refused: ' + error.message)
    process.exitCode = 2
  }
}
