import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { prepareCreationQualification } from './creation-qualification.ts'

// Local preparation only. This command has no credential reader or paid run mode.
export async function saveCreationQualification(path: string) {
  const packet = await prepareCreationQualification()
  const file = await Deno.open(path, {
    write: true,
    createNew: true,
    mode: 0o600,
  })
  try {
    const bytes = new TextEncoder().encode(
      JSON.stringify(packet, null, 2) + '\n'
    )
    let offset = 0
    while (offset < bytes.length)
      offset += await file.write(bytes.subarray(offset))
    await file.sync()
  } finally {
    file.close()
  }
  return packet.packet_sha256
}
export async function verifyCreationQualification(path: string) {
  const saved: unknown = JSON.parse(await Deno.readTextFile(path))
  const current = await prepareCreationQualification()
  if (canonicalizeJson(saved) !== canonicalizeJson(current))
    throw new Error('creation-qualification-packet-mismatch')
  return current.packet_sha256
}
if (import.meta.main) {
  const [mode, path, ...extra] = Deno.args
  if (!path || extra.length || !['prepare', 'verify'].includes(mode))
    throw new Error(
      'Use prepare|verify <packet-path>; no paid execution command'
    )
  const packet_sha256 =
    mode === 'prepare'
      ? await saveCreationQualification(path)
      : await verifyCreationQualification(path)
  console.log(
    JSON.stringify({
      packet_sha256,
      provider_calls: 0,
      qualified: false,
      approved_for_execution: false,
    })
  )
}
