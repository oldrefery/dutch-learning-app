import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { assertQaFixture } from './D08-qa-paths.mjs'

const fixturePath = process.argv[2]
if (fixturePath) assertQaFixture(fixturePath)
const fixture = fixturePath
  ? JSON.parse(readFileSync(fixturePath, 'utf8'))
  : null
const primary = fixture?.primary

// Disposable loopback-only transport. Never forwards to a hosted project/provider.
const state = {
  blockRest: false,
  blockContent: false,
  dropNextCommandReply: false,
  dropNextImportReply: false,
  blockWordWrites: false,
  hideRevisions: false,
  translation: 'QA local version',
}
const events = []
const send = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}
const updateControl = (request, body) => {
  if (request.method !== 'POST') return
  const input = JSON.parse(body.toString())
  for (const [key, value] of Object.entries(input)) {
    assert.ok(Object.hasOwn(state, key))
    assert.equal(typeof value, typeof state[key])
  }
  Object.assign(state, input)
}
const checkAuthInput = (path, body) => {
  if (path !== '/auth/v1/token' || !primary) return
  const input = JSON.parse(body.toString())
  if (input.email)
    events.push({
      kind: 'auth-input-check',
      emailMatches: input.email === primary.email,
      passwordMatches: input.password === primary.password,
      isolatedEmailMatches: input.email === fixture?.isolated?.email,
      isolatedPasswordMatches: input.password === fixture?.isolated?.password,
    })
}
const shouldBlockRest = (isContent, isWordWrite) =>
  state.blockRest ||
  (state.blockContent && isContent) ||
  (state.blockWordWrites && isWordWrite)

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1:55331')
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = Buffer.concat(chunks)
    checkAuthInput(url.pathname, body)
    if (url.pathname === '/__qa') {
      updateControl(request, body)
      send(response, 200, { state, events })
      return
    }
    if (url.pathname.startsWith('/functions/v1/')) {
      const input = JSON.parse(body.toString() || '{}')
      events.push({ kind: 'fixture', path: url.pathname })
      if (url.pathname.endsWith('/gemini-handler')) {
        send(response, 200, {
          success: true,
          data: {
            dutch_lemma: input.word,
            part_of_speech: 'noun',
            article: 'de',
            translations: { en: [state.translation], ru: ['QA fixture'] },
            examples: [],
            synonyms: [],
            antonyms: [],
            image_url: 'http://127.0.0.1:55331/fixture.png?v=1',
          },
        })
      } else if (url.pathname.endsWith('/get-multiple-images')) {
        send(response, 200, {
          images: [1, 2].map(version => ({
            url: `http://127.0.0.1:55331/fixture.png?v=${version}`,
            alt: `QA image ${version}`,
          })),
        })
      } else send(response, 404, { error: 'Unsupported local fixture' })
      return
    }
    if (url.pathname === '/fixture.png') {
      response.writeHead(200, { 'content-type': 'image/png' })
      response.end(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
          'base64'
        )
      )
      return
    }
    const isRest = url.pathname.startsWith('/rest/v1/')
    assert.ok(isRest || url.pathname.startsWith('/auth/v1/'))
    const isContent =
      url.pathname.startsWith('/rest/v1/dictionary_') ||
      url.pathname.startsWith('/rest/v1/rpc/get_dictionary_') ||
      url.pathname.startsWith('/rest/v1/rpc/list_dictionary_') ||
      url.pathname === '/rest/v1/rpc/apply_dictionary_content_command_v1'
    const isWordWrite =
      url.pathname === '/rest/v1/words' &&
      !['GET', 'HEAD'].includes(request.method)
    if (isRest && shouldBlockRest(isContent, isWordWrite)) {
      events.push({ kind: 'blocked', path: url.pathname })
      send(response, 503, { message: 'Injected local QA offline transport' })
      return
    }
    if (
      state.hideRevisions &&
      url.pathname === '/rest/v1/dictionary_revisions'
    ) {
      events.push({ kind: 'missing-dependency' })
      send(response, 200, [])
      return
    }
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port: 55321,
        path: request.url,
        method: request.method,
        headers: { ...request.headers, host: '127.0.0.1:55321' },
      },
      remote => {
        const isCommand =
          url.pathname === '/rest/v1/rpc/apply_dictionary_content_command_v1'
        const isImport = [
          '/rest/v1/rpc/apply_dictionary_import_intent_v1',
          '/rest/v1/rpc/recover_dictionary_import_v1',
          '/rest/v1/rpc/cancel_dictionary_import_v1',
        ].includes(url.pathname)
        if (isImport) {
          const input = JSON.parse(body.toString())
          events.push({
            kind: 'import-response',
            path: url.pathname,
            status: remote.statusCode,
            operationId: (input.p_intent ?? input.p_request)?.operation_id,
          })
        }
        if (isCommand)
          events.push({
            kind: 'command-response',
            status: remote.statusCode,
            operationId: JSON.parse(body.toString()).p_command.operation_id,
          })
        if (
          ((isCommand && state.dropNextCommandReply) ||
            (isImport && state.dropNextImportReply)) &&
          remote.statusCode === 200
        ) {
          if (isCommand) state.dropNextCommandReply = false
          if (isImport) state.dropNextImportReply = false
          state.blockRest = true
          remote.resume()
          remote.on('end', () => {
            events.push({ kind: 'accepted-reply-dropped' })
            response.destroy()
          })
        } else {
          response.writeHead(remote.statusCode, remote.headers)
          remote.pipe(response)
        }
      }
    )
    upstream.on('error', () =>
      send(response, 502, { message: 'Local upstream unavailable' })
    )
    upstream.end(body)
  } catch {
    send(response, 400, { message: 'Invalid local QA request' })
  }
})
server.listen(55331, '127.0.0.1', () => {
  console.log(
    'D08 loopback proxy ready on 55331; upstream 55321; providers disabled'
  )
})
