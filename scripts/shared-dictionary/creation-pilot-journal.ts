import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
export { writeOnce } from './semantic-qualification-cli.ts'
export async function readJson(path: string) {
  return record(JSON.parse(await Deno.readTextFile(path)))
}
export async function optionalJson(path: string) {
  try {
    return await readJson(path)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null
    throw error
  }
}
export async function digestFiles(directory: string, names: string[]) {
  const hashes: Record<string, string> = {}
  for (const name of names)
    hashes[name] = await sha256(await Deno.readTextFile(`${directory}/${name}`))
  return hashes
}
export function equal(actual: unknown, expected: unknown, message: string) {
  if (canonicalizeJson(actual) !== canonicalizeJson(expected))
    throw new Error(message)
}
export function localDay(at: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}
export interface CreationPilotAuthority {
  id: string
  kind: 'creation-qualification'
  packet_sha256: string
  local_day: string
  expires_at: string
  maximum_aggregate_usd: 15
  maximum_calls: 48
  automatic_retries: 0
  personal_google_project_confirmed: true
  distinct_judge_model_confirmed: true
  readiness_review_accepted: true
}
export function parseAuthority(
  value: unknown,
  hash: string
): CreationPilotAuthority {
  const a = record(value)
  if (
    Object.keys(a).length !== 11 ||
    !/^[A-Z0-9-]{1,80}$/.test(String(a.id)) ||
    a.kind !== 'creation-qualification' ||
    a.packet_sha256 !== hash ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(a.local_day)) ||
    typeof a.expires_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(a.expires_at) ||
    !Number.isFinite(Date.parse(a.expires_at)) ||
    localDay(Date.parse(a.expires_at) - 1) !== a.local_day ||
    a.maximum_aggregate_usd !== 15 ||
    a.maximum_calls !== 48 ||
    a.automatic_retries !== 0 ||
    a.personal_google_project_confirmed !== true ||
    a.distinct_judge_model_confirmed !== true ||
    a.readiness_review_accepted !== true
  )
    throw new Error('explicit-reviewed-creation-authority-required')
  return a as unknown as CreationPilotAuthority
}
export function checkDeadline(
  a: CreationPilotAuthority,
  packetExpiry: string,
  now: number
) {
  if (
    !Number.isFinite(now) ||
    localDay(now) !== a.local_day ||
    now >= Date.parse(a.expires_at) ||
    now >= Date.parse(packetExpiry)
  )
    throw new Error('creation-pilot-authority-expired')
}

export async function verifyRunBinding(run: Record<string, unknown>) {
  if (
    typeof run.packet_sha256 !== 'string' ||
    typeof run.authority_receipt !== 'string' ||
    (await sha256(run.authority_receipt)) !== run.authority_sha256 ||
    typeof run.run_id !== 'string' ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(run.run_id) ||
    typeof run.run_directory !== 'string' ||
    typeof run.allocated_at !== 'number'
  )
    throw new Error('invalid-creation-authority-binding')
  equal(
    JSON.parse(run.authority_receipt),
    run.authority,
    'creation-authority-receipt-binding-conflict'
  )
  const authority = parseAuthority(run.authority, run.packet_sha256)
  equal(run.allocation_id, authority.id, 'creation-authority-id-conflict')
  return authority
}
