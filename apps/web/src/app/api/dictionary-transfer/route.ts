import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDictionaryContentEnabled } from '@/features/dictionary/repository'
import { executeDictionaryTransfer } from '@/features/sharing/dictionary-transfer-commands'
import { hasSameTransferOrigin } from '@/features/sharing/dictionary-transfer-origin'
import {
  MAX_TRANSFER_REQUEST_BYTES,
  parseTransferCommand,
  type TransferReply,
} from '@/features/sharing/dictionary-transfer-contract'

const json = (value: TransferReply, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })

async function readCommand(request: Request) {
  const length = Number(request.headers.get('content-length'))
  if (length > MAX_TRANSFER_REQUEST_BYTES)
    throw new Error('Transfer request too large.')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing transfer request.')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_TRANSFER_REQUEST_BYTES) {
        await reader.cancel()
        throw new Error('Transfer request too large.')
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return parseTransferCommand(JSON.parse(text) as unknown)
  } finally {
    reader.releaseLock()
  }
}

export async function POST(request: Request) {
  if (!isDictionaryContentEnabled())
    return json(
      { status: 'error', message: 'Dictionary transfer is unavailable.' },
      404
    )
  if (
    !hasSameTransferOrigin(request) ||
    request.headers.get('content-type')?.split(';')[0].trim() !==
      'application/json'
  )
    return json({ status: 'error', message: 'Invalid transfer request.' }, 403)

  const client = await createClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user)
    return json(
      { status: 'error', message: 'Sign in to transfer a collection.' },
      401
    )
  let command
  try {
    command = await readCommand(request)
  } catch {
    return json(
      { status: 'error', message: 'Invalid or oversized JSON transfer.' },
      400
    )
  }
  try {
    return json(await executeDictionaryTransfer(client, data.user.id, command))
  } catch {
    return json(
      {
        status: 'error',
        message: 'Could not prepare the transfer. Please try again.',
      },
      500
    )
  }
}
