import assert from 'node:assert/strict'
import { withDictionaryPaidSpend } from './dictionaryPaidSpend.ts'
import { canonicalizeJson } from '../../../packages/domain/src/shared-dictionary.ts'
import { sha256 } from '../dictionary-analysis/protectedInput.ts'
import type { RpcClient } from '../dictionary-analysis/store.ts'

const request = async () => {
  const body = canonicalizeJson({ generationConfig: { maxOutputTokens: 8192 } })
  const model = 'gemini-fixture'
  return {
    model,
    body,
    input_sha256: await sha256(
      canonicalizeJson({ provider: 'gemini', model, body })
    ),
  }
}
const binding = 'd'.repeat(64)
function fixture(service: RpcClient, now = 0) {
  let calls = 0
  const transport = withDictionaryPaidSpend({
    actor: 'fixture-actor',
    bindingSha256: binding,
    service,
    now: () => now,
    transport: {
      invoke: () => {
        calls++
        return Promise.resolve({
          kind: 'provider-outcome-unknown' as const,
          evidence_sha256: null,
        })
      },
    },
  })
  return { transport, calls: () => calls }
}
Deno.test(
  'only a bound fresh monetary claim permits one transport invocation',
  async () => {
    const params: Record<string, unknown>[] = []
    const f = fixture({
      rpc: (name, args) => {
        assert.equal(name, 'claim_dictionary_paid_attempt_v1')
        params.push(args)
        return Promise.resolve({
          data: {
            allowed: true,
            expires_at: '2026-11-01T00:00:00Z',
            attempt_id: '33333333-3333-4333-8333-333333333333',
            request_sha256: args.p_request_sha256,
            invocation_key: args.p_invocation_key,
            model: args.p_model,
            binding_sha256: args.p_binding_sha256,
          },
          error: null,
        })
      },
    })
    await f.transport.invoke(await request(), 'attempt:1')
    assert.equal(f.calls(), 1)
    assert.equal(params[0].p_binding_sha256, binding)
    assert.equal(params[0].p_output_tokens, 8192)
  }
)
for (const mode of ['denied', 'error', 'expired', 'missing-expiry']) {
  Deno.test(`paid ${mode} never invokes the provider`, async () => {
    const f = fixture({
      rpc: (_name, args) =>
        Promise.resolve({
          data: {
            allowed: mode !== 'denied',
            attempt_id: '33333333-3333-4333-8333-333333333333',
            request_sha256: args.p_request_sha256,
            invocation_key: args.p_invocation_key,
            model: args.p_model,
            binding_sha256: args.p_binding_sha256,
            expires_at:
              mode === 'missing-expiry' ? undefined : '1970-01-01T00:00:00Z',
          },
          error: mode === 'error' ? { message: 'private-sql' } : null,
        }),
    })
    await assert.rejects(
      f.transport.invoke(await request(), 'attempt:1'),
      /paid-dispatch/
    )
    assert.equal(f.calls(), 0)
  })
}
for (const key of [
  'attempt_id',
  'request_sha256',
  'invocation_key',
  'model',
  'binding_sha256',
]) {
  Deno.test(
    `a mismatched monetary ${key} cannot authorize a different request`,
    async () => {
      const f = fixture({
        rpc: (_name, args) =>
          Promise.resolve({
            data: {
              allowed: true,
              expires_at: '2026-11-01T00:00:00Z',
              attempt_id: '33333333-3333-4333-8333-333333333333',
              request_sha256: args.p_request_sha256,
              invocation_key: args.p_invocation_key,
              model: args.p_model,
              binding_sha256: args.p_binding_sha256,
              [key]: 'mismatch',
            },
            error: null,
          }),
      })
      await assert.rejects(
        f.transport.invoke(await request(), 'attempt:1'),
        /paid-dispatch-unavailable/
      )
      assert.equal(f.calls(), 0)
    }
  )
}
Deno.test(
  'invalid hash, token limit and oversized requests fail before a monetary RPC',
  async () => {
    let rpcs = 0
    const f = fixture({
      rpc: () => {
        rpcs++
        throw new Error('unexpected-rpc')
      },
    })
    await assert.rejects(
      f.transport.invoke(
        { ...(await request()), input_sha256: 'f'.repeat(64) },
        'attempt'
      ),
      /invalid-paid-request/
    )
    const badLimit = canonicalizeJson({
      generationConfig: { maxOutputTokens: 8193 },
    })
    await assert.rejects(
      f.transport.invoke(
        {
          model: 'gemini-fixture',
          body: badLimit,
          input_sha256: await sha256(
            canonicalizeJson({
              provider: 'gemini',
              model: 'gemini-fixture',
              body: badLimit,
            })
          ),
        },
        'attempt'
      ),
      /invalid-paid-request/
    )
    const oversized = JSON.stringify({
      generationConfig: { maxOutputTokens: 8192 },
      data: 'x'.repeat(32768),
    })
    await assert.rejects(
      f.transport.invoke(
        {
          model: 'gemini-fixture',
          body: oversized,
          input_sha256: await sha256(
            canonicalizeJson({
              provider: 'gemini',
              model: 'gemini-fixture',
              body: oversized,
            })
          ),
        },
        'attempt'
      ),
      /invalid-paid-request/
    )
    assert.equal(rpcs, 0)
  }
)

Deno.test(
  'a claim response delayed past its shorter phase deadline never reaches transport',
  async () => {
    let now = 0
    let calls = 0
    const transport = withDictionaryPaidSpend({
      actor: 'fixture-actor',
      bindingSha256: binding,
      now: () => now,
      service: {
        rpc: async (_name, args) => {
          const grant = {
            allowed: true,
            attempt_id: '33333333-3333-4333-8333-333333333333',
            request_sha256: args.p_request_sha256,
            invocation_key: args.p_invocation_key,
            model: args.p_model,
            binding_sha256: args.p_binding_sha256,
            expires_at: '1970-01-01T00:00:01Z',
          }
          await Promise.resolve()
          now = 1001
          return { data: grant, error: null }
        },
      },
      transport: {
        invoke: () => {
          calls++
          return Promise.resolve({
            kind: 'provider-outcome-unknown' as const,
            evidence_sha256: null,
          })
        },
      },
    })
    await assert.rejects(
      transport.invoke(await request(), 'attempt:1'),
      /paid-dispatch-expired/
    )
    assert.equal(calls, 0)
  }
)
