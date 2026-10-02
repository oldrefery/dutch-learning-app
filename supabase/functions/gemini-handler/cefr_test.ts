import { assertEquals, assertNotEquals } from '@std/assert'
import { createGeminiCefrEstimate, readAnalysisCefrEstimate } from './cefr.ts'
import { parseAnalysisCefrEstimate } from '../../../packages/domain/src/analysis-cefr.ts'

const content = {
  dutch_lemma: 'huis',
  part_of_speech: 'noun',
  article: 'het',
  translations: { en: ['house'], ru: [] },
  examples: [{ nl: 'Dit is een huis.', en: 'This is a house.' }],
}

Deno.test(
  'CEFR estimate stamps server provenance and ignores provider review claims',
  async () => {
    const estimate = await createGeminiCefrEstimate(
      {
        level: 'A1',
        confidence: 0.8,
        source: 'editorial',
        status: 'reviewed',
        input_sha256: 'f'.repeat(64),
      },
      content
    )
    assertEquals(estimate?.source, 'model')
    assertEquals(estimate?.status, 'estimated')
    assertEquals(estimate?.method, 'gemini')
    assertNotEquals(estimate?.input_sha256, 'f'.repeat(64))
    assertEquals(await readAnalysisCefrEstimate(estimate, content), estimate)
  }
)

Deno.test(
  'legacy or malformed CEFR never breaks analysis and cannot assert a known level',
  async () => {
    for (const raw of [
      undefined,
      null,
      {},
      { level: 'a1', confidence: 0.8 },
      { level: 'C3', confidence: 1 },
      { level: 'A1', confidence: '1' },
      { level: 'A1', confidence: NaN },
      { level: 'A1', confidence: Infinity },
      { level: 'A1', confidence: -0.1 },
      { level: 'A1', confidence: 1.1 },
      { level: null, confidence: 0.9 },
    ]) {
      assertEquals(await createGeminiCefrEstimate(raw, content), null)
    }
    const unknown = await createGeminiCefrEstimate(
      { level: null, confidence: null },
      content
    )
    assertEquals(unknown?.status, 'unknown')
    assertEquals(unknown?.level, null)
  }
)

Deno.test(
  'cache estimate is discarded after changed meaning, examples or legacy key correction',
  async () => {
    const estimate = await createGeminiCefrEstimate(
      { level: 'A2', confidence: 0.6 },
      content
    )
    for (const changed of [
      { ...content, dutch_lemma: 'thuis' },
      { ...content, translations: { en: ['home'], ru: [] } },
      { ...content, examples: [] },
    ]) {
      assertEquals(await readAnalysisCefrEstimate(estimate, changed), null)
    }
    assertEquals(
      await readAnalysisCefrEstimate(estimate, {
        ...content,
        dutch_original: 'Het huis',
        image_url: 'https://example.invalid/new',
        usage_count: 55,
      }),
      estimate
    )
  }
)

Deno.test(
  'response parser rejects reviewed status, source claims and unsupported input versions',
  async () => {
    const estimate = await createGeminiCefrEstimate(
      { level: 'A1', confidence: 1 },
      content
    )
    for (const patch of [
      { status: 'reviewed' },
      { source: 'manual' },
      { input_version: 2 },
      { input_sha256: 'bad' },
      { method_version: '' },
      { level: null },
      { confidence: null },
    ]) {
      assertEquals(parseAnalysisCefrEstimate({ ...estimate, ...patch }), null)
    }
    assertEquals(
      await createGeminiCefrEstimate({ level: 'A1', confidence: 1 }, {}),
      null
    )
  }
)
