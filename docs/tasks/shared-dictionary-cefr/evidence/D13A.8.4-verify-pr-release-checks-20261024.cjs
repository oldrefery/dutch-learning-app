const fs = require('fs')
const path = require('path')
const assert = require('assert/strict')
const crypto = require('crypto')
const cp = require('child_process')
const { verifyChain } = require('./D13A.8.4-verify-diagnostics-20261024.cjs')
const root = path.resolve(__dirname, '../../../..')
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

function input(name) {
  assert.equal(typeof name, 'string')
  assert.ok(!path.isAbsolute(name) && !name.split(/[\\/]/).includes('..'))
  const file = path.join(root, name)
  assert.ok(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink())
  assert.ok(fs.realpathSync(file).startsWith(root + path.sep))
  return file
}

function verify(packet) {
  assert.equal(packet.packet_type, 'D13A.8.4-pr-release-checks')
  assert.equal(packet.source_commit, 'c3a1f2d900e119245f528b6c63a4e1a07682caa2')
  assert.equal(packet.pr, 124)
  assert.equal(packet.release_ready, false)
  assert.deepEqual(packet.authorized_release_commands, [])
  assert.equal(packet.source_maps_uploaded, false)
  for (const [name, hash] of Object.entries(packet.files_sha256))
    assert.equal(
      sha(fs.readFileSync(input(name))),
      hash,
      'Input hash differs: ' + name
    )
  const chains = []
  for (const platform of ['ios', 'android']) {
    const m = packet.maps[platform]
    const artifact = fs.readFileSync(input(m.artifact))
    assert.equal(sha(artifact), m.artifact_sha256)
    const extracted = cp.spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',
        input(m.artifact),
        m.entry,
      ],
      { encoding: null, maxBuffer: 20000000 }
    )
    assert.equal(extracted.status, 0, 'Cannot read native bytecode')
    const actual = extracted.stdout
    assert.equal(sha(actual), m.bytecode_sha256)
    assert.ok(
      actual.equals(fs.readFileSync(input(m.recompiled))),
      'Recompiled bytecode differs'
    )
    assert.equal(actual.readUInt32LE(8), 98)
    assert.ok(
      actual.subarray(12, 32).equals(
        crypto
          .createHash('sha1')
          .update(fs.readFileSync(input(m.source)))
          .digest()
      ),
      'Compiler source differs'
    )
    const chain = verifyChain(
      platform,
      path.dirname(path.dirname(input(m.source)))
    )
    assert.deepEqual(chain, m.chain_review)
    chains.push(chain)
  }
  const gates = JSON.parse(fs.readFileSync(input(packet.release_gates)))
  assert.equal(gates.read_only_confirmed, true)
  assert.equal(gates.ledger_versions, 66)
  assert.equal(gates.all14_migration_body_hashes_match, true)
  assert.equal(gates.new_db_flags_false, 14)
  assert.equal(gates.legacy_flags_true, 3)
  assert.equal(gates.two_endpoint_environment_gates_false, true)
  assert.equal(gates.jwt_gateway_enabled, true)
  assert.equal(gates.production_writes, 0)
  assert.equal(gates.provider_invocations, 0)
  assert.equal(packet.budget.new_paid_requests, 0)
  assert.equal(packet.budget.unknown_held_usd, '0.56')
  assert.deepEqual(packet.remaining, {
    stage_steps: 3,
    later_major_milestones: 6,
  })
  assert.ok(
    !process.argv.includes('--check-execution'),
    'Release execution is forbidden'
  )
  return {
    status: 'pr_release_checks_verified',
    maps: chains,
    production_writes: 0,
    release_authorized: false,
  }
}

module.exports = { verify }
if (require.main === module) {
  try {
    console.log(
      JSON.stringify(
        verify(JSON.parse(fs.readFileSync(input(process.argv[2])))),
        null,
        2
      )
    )
  } catch (error) {
    console.error('Verification refused: ' + error.message)
    process.exitCode = 2
  }
}
