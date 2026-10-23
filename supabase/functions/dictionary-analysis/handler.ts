import { parseDictionaryAnalysisCommandV2 } from '../../../packages/domain/src/dictionary-analysis.ts'
import {
  runDictionaryAnalysis,
  type AnalysisWorkerDependencies,
} from './worker.ts'
import { AnalysisAcceptanceError } from './store.ts'

export interface AnalysisHandlerDependencies {
  verifyUser(token: string): Promise<string | null>
  forCaller(token: string): AnalysisWorkerDependencies
}
const reply = (status: number, body: unknown): Response =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
const commandBody = async (request: Request): Promise<unknown> => {
  if (!request.body) throw new Error('invalid-analysis-command')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > 2048) {
        await reader.cancel()
        return null
      }
      chunks.push(part.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    return null
  }
}
export const createDictionaryAnalysisHandler =
  (dependencies: AnalysisHandlerDependencies) =>
  async (request: Request): Promise<Response> => {
    if (request.method !== 'POST')
      return reply(405, { code: 'method-not-allowed' })
    const token = /^Bearer\s+([^\s]+)$/i.exec(
      request.headers.get('Authorization')?.trim() ?? ''
    )?.[1]
    if (!token) return reply(401, { code: 'authentication-required' })
    try {
      // The production adapter must use Auth getUser(token), not getSession or
      // unverified JWT claims. SQL acceptance derives auth.uid() independently.
      const actor = await dependencies.verifyUser(token)
      if (!actor) return reply(401, { code: 'authentication-required' })
      const parsed = parseDictionaryAnalysisCommandV2(
        await commandBody(request)
      )
      if (!parsed.success)
        return reply(400, { code: 'invalid-analysis-command' })
      const result = await runDictionaryAnalysis(
        actor,
        parsed.data,
        dependencies.forCaller(token)
      )
      return reply(
        'outcome' in result ||
          [
            'accepted',
            'dispatching',
            'validating',
            'provider-outcome-unknown',
          ].includes(result.status)
          ? 202
          : 200,
        result
      )
    } catch (error) {
      if (error instanceof AnalysisAcceptanceError)
        return reply(error.status, { code: error.code })
      return reply(503, {
        code: 'analysis-unavailable',
        retry: 'same-operation-only',
      })
    }
  }
