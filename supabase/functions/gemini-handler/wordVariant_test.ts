import { additionalPreposition } from '../../../packages/domain/src/dutch-headword.ts'
import { assertEquals } from '@std/assert'
import {
  exactPhraseInput,
  matchesWordVariant,
  parseWordVariantInput,
  readWordVariantChoices,
} from '../../../packages/domain/src/word-variant.ts'

Deno.test(
  'word variant hints are recognized consistently with and without parentheses',
  () => {
    for (const [hint, partOfSpeech] of [
      ['adj', 'adjective'],
      ['adjective', 'adjective'],
      ['v', 'verb'],
      ['verb', 'verb'],
      ['n', 'noun'],
      ['noun', 'noun'],
      ['adv', 'adverb'],
      ['adverb', 'adverb'],
    ]) {
      for (const word of [
        `overleden ${hint}`,
        ` overl eden ( ${hint.toUpperCase()} ) `,
      ]) {
        const parsed = parseWordVariantInput(word)
        assertEquals(parsed.partOfSpeech, partOfSpeech)
        assertEquals(
          parsed.word,
          word.trim().startsWith('overleden') ? 'overleden' : 'overl eden'
        )
        assertEquals(parsed.error, null)
      }
    }
  }
)

Deno.test(
  'article variants are equivalent, preserve phrases and reject conflicts',
  () => {
    assertEquals(
      parseWordVariantInput('het idee'),
      parseWordVariantInput('idee ( het )')
    )
    assertEquals(
      parseWordVariantInput('de idee'),
      parseWordVariantInput('idee (de)')
    )
    assertEquals(parseWordVariantInput('ik weet het').word, 'ik weet het')
    assertEquals(parseWordVariantInput('het kan ook').word, 'het kan ook')
    assertEquals(parseWordVariantInput('idee het').word, 'idee het')
    assertEquals(
      parseWordVariantInput('iets (specifieks)').word,
      'iets (specifieks)'
    )
    assertEquals(parseWordVariantInput('verb').word, 'verb')
    assertEquals(Boolean(parseWordVariantInput('de idee (het)').error), true)
    assertEquals(Boolean(parseWordVariantInput('het idee adj').error), true)
  }
)

Deno.test('choices distinguish articles and reject unrelated analyses', () => {
  const idea = {
    lemma: 'idee',
    partOfSpeech: 'noun',
    article: 'het',
    translations: { en: 'idea', ru: 'идея' },
  }
  const choices = readWordVariantChoices([
    idea,
    idea,
    { ...idea, article: 'de' },
    { ...idea, article: 'een' },
  ])
  assertEquals(
    choices.map(choice => choice.article),
    ['het', 'de']
  )
  assertEquals(matchesWordVariant(choices[1], { article: 'het' }), false)
  assertEquals(matchesWordVariant(choices[1], { lemma: 'concept' }), false)
  assertEquals(
    matchesWordVariant(choices[1], { lemma: ' Idee ', partOfSpeech: 'noun' }),
    true
  )
})

Deno.test(
  'whole phrases and headword prepositions respect word boundaries',
  () => {
    assertEquals(exactPhraseInput('  Ik   heb er zin in '), 'Ik heb er zin in')
    assertEquals(exactPhraseInput('de eieren'), null)
    assertEquals(exactPhraseInput('overleden adj'), null)
    assertEquals(additionalPreposition('zin hebben in', 'in'), null)
    assertEquals(additionalPreposition('Ik heb er zin in!', 'in'), null)
    assertEquals(additionalPreposition('wachten', 'op'), 'op')
    assertEquals(additionalPreposition('zin', 'in'), 'in')
  }
)
