import {
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { formatWordAnalysisPrompt } from './geminiPrompts.ts'

Deno.test('word analysis prompt requests bounded usage guidance', () => {
  const prompt = formatWordAnalysisPrompt('woning')

  assertStringIncludes(prompt, '"usage_notes"')
  assertStringIncludes(prompt, 'at most three `contrasts`')
  assertStringIncludes(prompt, 'woning')
  assertEquals(
    prompt.startsWith('\nYou are an expert Dutch language teacher'),
    true
  )
})

Deno.test(
  'the literal learner input appears once and no placeholders remain',
  () => {
    const input = 'proefinvoer "één"'
    const prompt = formatWordAnalysisPrompt(input)
    assertEquals(prompt.split(JSON.stringify(input)).length, 2)
    assertEquals(prompt.endsWith(JSON.stringify(input)), true)
    assertEquals(prompt.includes('{{WORD}}'), false)
  }
)

Deno.test(
  'word analysis pairs English and Russian equivalents by sense',
  () => {
    const prompt = formatWordAnalysisPrompt('kloppen')
    assertStringIncludes(
      prompt,
      'entries at the same index must cover the same Dutch sense'
    )
    assertStringIncludes(
      prompt,
      '"to be correct" with "быть верным" or "быть правильным"'
    )
    assertStringIncludes(prompt, 'a protected anchor specifies one sense')
  }
)

Deno.test(
  'word analysis keeps optional prepositions out of the headword',
  () => {
    const prompt = formatWordAnalysisPrompt('stellen een vraag')
    assertStringIncludes(
      prompt,
      'Use a non-null value only if the preposition is obligatory'
    )
    assertStringIncludes(prompt, '"een vraag stellen" with preposition null')
    assertStringIncludes(prompt, '"Mag ik u een vraag stellen?"')
    assertStringIncludes(
      prompt,
      '"genieten", "part_of_speech": "verb", "preposition": null'
    )
    assertStringIncludes(
      prompt,
      'preserve it in the headword (e.g. "werken aan")'
    )
  }
)
