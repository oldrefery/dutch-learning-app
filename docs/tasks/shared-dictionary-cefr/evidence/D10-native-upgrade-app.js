// This template is copied into a private Expo build; it is not an app entrypoint.
import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { registerRootComponent } from 'expo'
import * as SQLite from 'expo-sqlite'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  equal,
  intent,
  seed,
  snapshot,
  USER,
  WORD,
} from './D10-native-upgrade-fixture'

const PHASE = 'd10_upgrade_phase'
async function record(results, phase, details) {
  await results.runAsync(
    'INSERT INTO results(phase,details) VALUES (?,?)',
    phase,
    JSON.stringify(details)
  )
}
async function initializeHistorical(test) {
  equal(
    await AsyncStorage.getItem(`d10_schema_v${test.version}`),
    null,
    'Refusing to overwrite retained historical fixture'
  )
  const db = await test.old.initializeDatabase()
  equal(
    await AsyncStorage.getItem(`d10_schema_v${test.version}`),
    String(test.version),
    'Historical marker mismatch'
  )
  equal(
    await db.getAllAsync(
      "SELECT name FROM sqlite_master WHERE name='dictionary_import_delivery'"
    ),
    [],
    'Historical database already contains v16'
  )
  await seed(db, test.version)
  const before = await snapshot(db, test.version)
  equal(
    before.learning_commands.map(row => row.kind),
    ['review', 'reset', 'correction'],
    'Missing retained learning queue'
  )
  await AsyncStorage.setItem(
    `d10_before_v${test.version}`,
    JSON.stringify(before)
  )
  await test.old.closeDatabase()
  return before
}
async function verifyUpgrade(test, expectedVersion, requireOrigin) {
  equal(
    await AsyncStorage.getItem(`d10_schema_v${test.version}`),
    expectedVersion,
    'Persisted schema marker mismatch before initialization'
  )
  const before = JSON.parse(
    await AsyncStorage.getItem(`d10_before_v${test.version}`)
  )
  const db = await test.current.initializeDatabase()
  equal(
    await AsyncStorage.getItem(`d10_schema_v${test.version}`),
    '16',
    'Native migration marker not persisted'
  )
  equal(
    await snapshot(db, test.version),
    before,
    'Retained data or queue changed'
  )
  equal(
    await db.getAllAsync('PRAGMA foreign_key_check'),
    [],
    'Foreign-key violation'
  )
  equal(
    await db.getFirstAsync('PRAGMA integrity_check'),
    { integrity_check: 'ok' },
    'Integrity check failed'
  )
  const delivery = await db.getAllAsync(
    'SELECT * FROM dictionary_import_delivery'
  )
  equal(
    delivery,
    [
      {
        word_id: WORD,
        user_id: USER,
        original_intent_json:
          test.version === 14 ? JSON.stringify(intent) : null,
        local_placement_revision: 0,
        acknowledged_placement_revision: null,
        recovery_version: test.version === 14 ? 0 : null,
        cancelled: 0,
      },
    ],
    'Incorrect provenance or acknowledgement backfill'
  )
  equal(
    await db.getAllAsync('SELECT * FROM dictionary_import_recovery_outbox'),
    [],
    'Migration synthesized a recovery command'
  )
  const issues = await test.view.getIssues(USER)
  equal(
    issues,
    [{ word_id: WORD, issue: test.version === 14 ? 'pending' : 'unverified' }],
    'Incorrect recovery gate'
  )
  equal(
    await test.view.getIssues('another-owner'),
    [],
    'Recovery issue exposed to another owner'
  )
  if (test.version === 14)
    equal(requireOrigin(delivery[0]), intent, 'Exact original intent lost')
  else {
    let message = null
    try {
      requireOrigin(delivery[0])
    } catch (error) {
      message = error.message
    }
    equal(
      message,
      'Exact import provenance is unavailable. Local data remains saved.',
      'Marker-only provenance must remain blocked'
    )
  }
  await test.current.closeDatabase()
  return {
    version: test.version,
    preservedTables: Object.keys(before),
    delivery,
    issues,
    marker: '16',
  }
}
async function run(cases, requireOrigin) {
  const results = await SQLite.openDatabaseAsync('d10-results.db', {
    useNewConnection: true,
  })
  try {
    await results.execAsync(
      'CREATE TABLE IF NOT EXISTS results(sequence INTEGER PRIMARY KEY AUTOINCREMENT,phase TEXT NOT NULL,details TEXT NOT NULL)'
    )
    const phase = await AsyncStorage.getItem(PHASE)
    if (phase === 'failed')
      throw new Error(
        'Previous failure retained; inspect results before changing anything'
      )
    if (phase === 'complete') return 'Already complete; evidence retained'
    const details = []
    if (phase === null) {
      for (const test of cases)
        details.push({
          version: test.version,
          before: await initializeHistorical(test),
        })
      await record(results, 'historical-seeded', details)
      await AsyncStorage.setItem(PHASE, 'seeded')
      return 'Historical v14/v15 seeded. Restart the process.'
    }
    if (phase !== 'seeded' && phase !== 'migrated')
      throw new Error('Unexpected retained phase')
    for (const test of cases)
      details.push(
        await verifyUpgrade(
          test,
          phase === 'seeded' ? String(test.version) : '16',
          requireOrigin
        )
      )
    await record(
      results,
      phase === 'seeded' ? 'native-upgrade-passed' : 'cold-restart-passed',
      details
    )
    await AsyncStorage.setItem(
      PHASE,
      phase === 'seeded' ? 'migrated' : 'complete'
    )
    return phase === 'seeded'
      ? 'Native upgrade passed. Restart the process.'
      : 'Native upgrade and cold restart passed.'
  } catch (error) {
    await record(results, 'failed', {
      message: error.message,
      stack: error.stack,
    })
    await AsyncStorage.setItem(PHASE, 'failed')
    throw error
  } finally {
    await results.closeAsync()
  }
}
export function registerUpgradeHarness(cases, requireOrigin) {
  // Keep one run per process even if the view remounts.
  let execution
  function App() {
    const [status, setStatus] = useState('Running native migration evidence')
    useEffect(() => {
      execution ??= run(cases, requireOrigin)
      execution.then(setStatus, error => setStatus(`FAILED: ${error.message}`))
    }, [])
    return React.createElement(
      View,
      null,
      React.createElement(Text, null, status)
    )
  }
  registerRootComponent(App)
}
