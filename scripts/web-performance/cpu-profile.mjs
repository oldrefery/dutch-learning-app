import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'

// Connect only to the inspector of a process started by this isolated harness.
export async function connectServerProfiler(processHandle) {
  const match = processHandle
    .text()
    .match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)
  assert.ok(match, 'Owned server inspector URL is missing')
  const socket = new globalThis.WebSocket(match[1])
  const pending = new Map()
  let sequence = 0
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    clearTimeout(request.timer)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  })
  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer)
      request.reject(new Error('Owned inspector disconnected'))
    }
    pending.clear()
  })
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`Inspector command timed out: ${method}`))
      }, 10000)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params }))
    })
  await send('Profiler.enable')
  return {
    send,
    close: () =>
      new Promise(resolve => {
        if (socket.readyState === globalThis.WebSocket.CLOSED) {
          resolve()
          return
        }
        socket.addEventListener('close', resolve, { once: true })
        socket.close()
      }),
  }
}

export async function startCpuProfiles(context, page, server, pair) {
  if (!server || pair === 'warmup') return async () => {}
  const client = await context.newCDPSession(page)
  await client.send('Profiler.enable')
  await client.send('Tracing.start', {
    categories:
      'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline',
    transferMode: 'ReturnAsStream',
  })
  await server.send('Profiler.start')
  await client.send('Profiler.start')
  let stopped = false
  return async prefix => {
    if (stopped) return
    stopped = true
    const browser = await client.send('Profiler.stop')
    const backend = await server.send('Profiler.stop')
    const complete = new Promise(resolve =>
      client.once('Tracing.tracingComplete', resolve)
    )
    await client.send('Tracing.end')
    const { stream, dataLossOccurred } = await complete
    assert.ok(!dataLossOccurred, 'Browser trace lost events')
    assert.ok(stream, 'Browser trace stream is missing')
    const chunks = []
    for (;;) {
      const chunk = await client.send('IO.read', { handle: stream })
      chunks.push(
        chunk.base64Encoded
          ? Buffer.from(chunk.data, 'base64').toString('utf8')
          : chunk.data
      )
      if (chunk.eof) break
    }
    await client.send('IO.close', { handle: stream })
    await writeFile(`${prefix}-browser-trace.json`, chunks.join(''))
    await client.detach()
    await writeFile(
      `${prefix}-browser.cpuprofile`,
      JSON.stringify(browser.profile)
    )
    await writeFile(
      `${prefix}-server.cpuprofile`,
      JSON.stringify(backend.profile)
    )
  }
}
