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
