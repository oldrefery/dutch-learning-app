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
