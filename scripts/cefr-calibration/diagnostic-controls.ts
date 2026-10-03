import { randomUUID } from 'node:crypto'
import { isPreparedBundle, type DiagnosticBundle } from './diagnostic-bundle.ts'
import {
  captureControl,
  claimLease,
  openRun,
  releaseLease,
  renewLease,
  reserveControl,
  type ControlKey,
} from './diagnostic-store.ts'
import {
  GEMINI_BASE,
  createGeminiTestAdapter,
  parseGeminiMetadata,
  prepareGeminiRequest,
  requestDigest,
  type GeminiModelMetadata,
} from './diagnostic-gemini.ts'

// No generation or live transport is connected to this local preparation probe.
export const probeGeminiControls = async (options: {
  runDir: string
  bundle: DiagnosticBundle
  adapter: ReturnType<typeof createGeminiTestAdapter>
  now?: () => Date
  onReserved?: (id: string) => void
}) => {
  const { runDir, bundle, adapter, onReserved } = options
  if (!isPreparedBundle(bundle)) throw new Error('Prepared bundle required')
  if (adapter.kind !== 'test-only') throw new Error('Test adapter required')
  const countTokens = adapter.countTokens.bind(adapter),
    modelMetadata = adapter.modelMetadata.bind(adapter)
  const clock = options.now ?? (() => new Date()),
    started = clock()
  const db = openRun(runDir, bundle, started),
    owner = randomUUID()
  const checkDay = () => {
    if (
      clock().toISOString().slice(0, 10) !== started.toISOString().slice(0, 10)
    )
      throw new Error('Control day changed')
  }
  try {
    claimLease(db, owner)
    const runId = (
      db.prepare("SELECT value FROM meta WHERE key='run_id'").get() as {
        value: string
      }
    ).value
    // Validate every wire request before reserving or sending even model metadata.
    const requests = bundle.meanings.map(meaning =>
      prepareGeminiRequest(bundle, meaning.id, runId)
    )
    const control = async <T>(
      key: ControlKey,
      dispatch: () => Promise<T>,
      validate: (value: unknown) => T
    ): Promise<T> => {
      checkDay()
      renewLease(db, owner)
      const cached = reserveControl(db, bundle, key, owner, clock())
      if (cached !== null) return validate(JSON.parse(cached) as unknown)
      onReserved?.(key.id)
      checkDay()
      renewLease(db, owner)
      const result = validate(await dispatch())
      // Retain a verified receipt even if its response crossed midnight.
      captureControl(db, key, JSON.stringify(result), owner)
      checkDay()
      return result
    }
    const metadata = await control<GeminiModelMetadata>(
      {
        id: 'model_metadata',
        kind: 'model_metadata',
        requestSha256: requestDigest(`GET ${GEMINI_BASE}`),
      },
      modelMetadata,
      parseGeminiMetadata
    )
    const tokens: Record<string, number> = {}
    for (const request of requests) {
      tokens[request.itemId] = await control<number>(
        {
          id: request.itemId,
          kind: 'count_tokens',
          requestSha256: request.sha256,
        },
        () => countTokens(request),
        value => {
          if (
            !Number.isSafeInteger(value) ||
            Number(value) < 0 ||
            Number(value) > bundle.maxInputTokens
          )
            throw new Error('Control token bound')
          return value as number
        }
      )
    }
    return {
      kind: 'test-only' as const,
      runId,
      metadata,
      tokens,
      controlRequests: 25,
      billingVerified: false as const,
      liveReady: false as const,
    }
  } finally {
    try {
      releaseLease(db, owner)
    } finally {
      db.close()
    }
  }
}
