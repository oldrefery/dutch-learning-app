import {
  prepareTerminalReconciliation,
  applyTerminalReconciliation,
} from './creation-terminal-settlement.ts'
import { writeOnce } from './creation-pilot-journal.ts'

if (import.meta.main) {
  const [mode, packetPath, path, hash, output, ...extra] = Deno.args
  if (extra.length || !packetPath || !path || !hash)
    throw new Error(
      'Use prepare <packet> <review> <review-sha256> <new-calculation> | apply <packet> <calculation> <calculation-sha256>'
    )
  const budgetDirectory =
    'reports/shared-dictionary-cefr/creation-pilot-day-budget'
  if (mode === 'prepare' && output) {
    const calculation = await prepareTerminalReconciliation({
      packetPath,
      budgetDirectory,
      reviewPath: path,
      reviewSha256: hash,
    })
    await writeOnce(output, calculation)
    console.log(
      JSON.stringify({
        committed_nanousd: calculation.settlement.committed_nanousd,
        released_nanousd: calculation.settlement.released_nanousd,
        ledger_changed: false,
        paid_calls: 0,
      })
    )
  } else if (mode === 'apply' && !output) {
    const settlement = await applyTerminalReconciliation({
      packetPath,
      budgetDirectory,
      calculationPath: path,
      calculationSha256: hash,
    })
    console.log(
      JSON.stringify({
        committed_nanousd: settlement.committed_nanousd,
        released_nanousd: settlement.released_nanousd,
        authority_replenished: false,
        paid_calls: 0,
      })
    )
  } else throw new Error('Invalid terminal accounting command arguments')
}
