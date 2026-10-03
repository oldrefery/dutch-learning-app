import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadDiagnosticBundle } from './diagnostic-bundle.ts'
import {
  loadDiagnosticExecution,
  diagnosticImplementationSha256,
} from './diagnostic-execution.ts'
import { buildReport } from './diagnostic-report.ts'
import { openRun } from './diagnostic-store.ts'
import {
  GEMINI_BASE,
  GEMINI_MODEL,
  type TestHttp,
} from './diagnostic-gemini.ts'

const evidence = 'docs/tasks/shared-dictionary-cefr/evidence/'
export const paths = {
  worklist: `${evidence}D11-pilot-review-worklist.json`,
  reference: `${evidence}D11-pilot-provisional-reference.json`,
  profile: `${evidence}D11-pilot-profile.proposed.json`,
  prompt: `${evidence}D11-pilot-prompt.txt`,
  proposal: `${evidence}D11-pilot-proposal-summary.json`,
}
export const bundle = loadDiagnosticBundle(paths)
const sha = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex')
export const key = 'TEST-ONLY-NOT-A-CREDENTIAL'
export const generationSuffix = ':generateContent'
export const json = (value: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
export const metadata = {
  name: `models/${GEMINI_MODEL}`,
  baseModelId: GEMINI_MODEL,
  version: '3.5',
  inputTokenLimit: 1000000,
  outputTokenLimit: 65536,
  thinking: true,
  supportedGenerationMethods: ['generateContent', 'countTokens'],
}
export const generation = (init: RequestInit, sequence: number) => {
  const body = JSON.parse(String(init.body)) as {
    contents: { parts: { text: string }[] }[]
  }
  const identity = JSON.parse(
    body.contents[0].parts[0].text.split('\n')[1]
  ) as { job_id: string }
  const ambiguous = /pilot-2[34]$/.test(identity.job_id)
  return {
    responseId: `TEST-ONLY-response-${sequence}`,
    modelVersion: GEMINI_MODEL,
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            {
              text: JSON.stringify({
                ...identity,
                ambiguous,
                candidate: {
                  level: ambiguous ? null : 'A1',
                  confidence: ambiguous ? null : 0.5,
                },
              }),
            },
          ],
        },
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 10,
      totalTokenCount: 130,
      serviceTier: 'standard',
    },
  }
}
export const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'd11-runner-test-'))
  const runDir = join(root, 'run'),
    draftPath = join(root, 'draft.json'),
    authorizationPath = join(root, 'authorization.json'),
    credentialPath = join(root, 'key.txt')
  const draft = readFileSync(`${evidence}D11-gemini-live-request.proposed.json`)
  writeFileSync(draftPath, draft, { mode: 0o600 })
  writeFileSync(credentialPath, key, { mode: 0o600 })
  let milliseconds = Date.now()
  const day = new Date(milliseconds).toISOString().slice(0, 10)
  const raw = {
    namespace: 'dictionary-cefr-execution-v1',
    approved: true,
    execution_enabled: true,
    approval_kind: 'test-only',
    implementation_revision: 'd11-gemini-runner-v1',
    implementation_sha256: diagnosticImplementationSha256(),
    bundle_sha256: bundle.bindingSha256,
    draft_sha256: sha(draft),
    credential_sha256: sha(key),
    run_dir: runDir,
    journal_binding_path: join(root, 'execution-use.json'),
    run_id: '11111111-1111-4111-8111-111111111111',
    utc_day: day,
    expires_at: new Date(
      Math.min(milliseconds + 120000, Date.parse(`${day}T23:59:59.999Z`))
    ).toISOString(),
    approval_ref: 'TEST-ONLY-approval',
    account: {
      personal: true,
      paid_tier: true,
      account_ref: 'TEST-ONLY-account',
      project_ref: 'TEST-ONLY-project',
      verification_ref: 'TEST-ONLY-verification',
    },
    pricing: {
      model: GEMINI_MODEL,
      service_tier: 'standard',
      rates_microusd_per_token: bundle.rates,
      api_use_ceiling_microusd: bundle.ceiling,
      pricing_ref:
        'https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash',
      count_request_max_microusd: 1000,
      metadata_request_max_microusd: 500,
      control_billing_verification_ref: 'TEST-ONLY-billing',
      total_reserved_tokens: 340608,
    },
    sources: bundle.meanings.map(item => ({
      item_id: item.id,
      input_sha256: item.inputHash,
      approval_ref: 'TEST-ONLY-source',
    })),
  }
  const save = () =>
    writeFileSync(authorizationPath, JSON.stringify(raw), { mode: 0o600 })
  save()
  const options = {
    bundle,
    draftPath,
    authorizationPath,
    credentialPath,
    runDir,
  }
  const load = () =>
    loadDiagnosticExecution({ ...options, now: new Date(milliseconds) })
  const calls: { url: string; init: RequestInit }[] = []
  let generations = 0
  const success: TestHttp = async (url, init) => {
    calls.push({ url, init })
    assert.equal(
      (init.headers as Record<string, string>)['x-goog-api-key'],
      key
    )
    if (url === GEMINI_BASE) return json(metadata)
    if (url.endsWith(':countTokens')) return json({ totalTokens: 100 })
    return json(generation(init, ++generations))
  }
  const runner = (execution = load(), http = success) => ({
    bundle,
    execution,
    http,
    now: () => new Date(milliseconds),
    wait: async (ms: number) => {
      milliseconds += ms
    },
    jitter: () => 0,
  })
  const report = (execution = load()) => {
    const db = openRun(runDir, bundle, new Date(milliseconds), execution)
    try {
      return buildReport(db, bundle)
    } finally {
      db.close()
    }
  }
  return {
    root,
    raw,
    save,
    options,
    load,
    calls,
    success,
    runner,
    report,
    advance: (ms: number) => {
      milliseconds += ms
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}
