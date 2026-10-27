import { parseCreationCommand } from './contracts.ts'
import {
  CreationAuthenticationError,
  runDictionaryCreation,
  type CreationWorkerDependencies,
} from './worker.ts'
import { CreationAcceptanceError } from './store.ts'

const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const readCommand = async (request: Request): Promise<unknown> => {
  if (!request.body) return null
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
export const createDictionaryCreationHandler =
  (dependencies: {
    verifyUser(token: string): Promise<string | null>
    forCaller(
      token: string,
      actor: string
    ): Omit<CreationWorkerDependencies, 'verifyActor'>
  }) =>
  async (request: Request): Promise<Response> => {
    if (request.method !== 'POST')
      return reply(405, { code: 'method-not-allowed' })
    const token = /^Bearer\s+([^\s]+)$/i.exec(
      request.headers.get('Authorization')?.trim() ?? ''
    )?.[1]
    if (!token) return reply(401, { code: 'authentication-required' })
    try {
      const actor = await dependencies.verifyUser(token)
      if (!actor) return reply(401, { code: 'authentication-required' })
      let command
      try {
        command = parseCreationCommand(await readCommand(request))
      } catch {
        return reply(400, { code: 'invalid-creation-command' })
      }
      const response = await runDictionaryCreation(actor, command, {
        ...dependencies.forCaller(token, actor),
        verifyActor: () => dependencies.verifyUser(token),
      })
      return reply(
        'outcome' in response ||
          [
            'accepted',
            'dispatching',
            'validating',
            'provider-outcome-unknown',
          ].includes(response.status)
          ? 202
          : 200,
        response
      )
    } catch (error) {
      if (error instanceof CreationAuthenticationError)
        return reply(401, { code: 'authentication-required' })
      if (error instanceof CreationAcceptanceError)
        return reply(error.status, { code: error.code })
      return reply(503, {
        code: 'creation-unavailable',
        retry: 'same-operation-only',
      })
    }
  }
