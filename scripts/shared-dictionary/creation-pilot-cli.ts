import { checkCreationConnectivity } from './creation-connectivity.ts'
import {
  creationPilotPacket,
  verifyCreationPilotPacket,
} from './creation-pilot-packet.ts'
import { writeOnce } from './creation-pilot-journal.ts'
import { runCreationPilot } from './creation-pilot-runner.ts'
import { replayCreationPilot } from './creation-pilot-replay.ts'
import { createGeminiTransport } from '../../supabase/functions/dictionary-analysis/geminiTransport.ts'
if (import.meta.main) {
  const [mode, path, output, authority, ...extra] = Deno.args
  if (extra.length || !path)
    throw new Error(
      'Use prepare|verify <packet> | replay <run> <new-report> | run <packet> <new-run> <authority>'
    )
  if (mode === 'prepare' && !output && !authority) {
    const p = await creationPilotPacket()
    await writeOnce(path, p)
    console.log(
      JSON.stringify({
        packet_sha256: p.packet_sha256,
        qualified: false,
        paid_calls: 0,
      })
    )
  } else if (mode === 'verify' && !output && !authority) {
    const p = await verifyCreationPilotPacket(path)
    console.log(
      JSON.stringify({
        packet_sha256: p.packet_sha256,
        qualified: false,
        paid_calls: 0,
      })
    )
  } else if (mode === 'replay' && output && !authority) {
    const report = await replayCreationPilot(path)
    await writeOnce(output, report)
    console.log(
      JSON.stringify({
        complete: report.complete,
        thresholds_pass: report.thresholds_pass,
        new_provider_calls: 0,
        qualified: false,
      })
    )
  } else if (mode === 'run' && output && authority) {
    const report = await runCreationPilot({
      packetPath: path,
      output,
      authorityPath: authority,
      budgetDirectory:
        'reports/shared-dictionary-cefr/creation-pilot-day-budget',
      preflightConnectivity: checkCreationConnectivity,
      transportFactory: () => {
        const apiKey = Deno.env.get('DICTIONARY_ANALYSIS_GEMINI_API_KEY')
        if (!apiKey)
          throw new Error('Creation qualification API key unavailable')
        return createGeminiTransport({ apiKey, fetch })
      },
    })
    console.log(
      JSON.stringify({
        complete: report.complete,
        thresholds_pass: report.thresholds_pass,
        provider_results: report.provider_results,
        qualified: false,
      })
    )
  } else throw new Error('Invalid creation pilot command arguments')
}
