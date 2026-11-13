import {
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { assertRussianScript, invalidRussianFields } from './russianText.ts'

Deno.test(
  'Russian fields reject transliteration and mixed-script words from the reported card',
  () => {
    const value = {
      translations: {
        ru: ['posledstviya', 'otголоски', 'poslerodovyye skhvatki'],
      },
      examples: [{ ru: 'Kompaniya vse yeshche oshchushchayet posledstviya.' }],
      usage_notes: {
        contrasts: [{ example: { ru: 'Posle rodov ona stradala.' } }],
      },
    }
    assertEquals(invalidRussianFields(value), [
      'translations.ru[0]',
      'translations.ru[1]',
      'translations.ru[2]',
      'examples[0].ru',
      'usage_notes.contrasts[0].example.ru',
    ])
    assertThrows(
      () => assertRussianScript(value),
      Error,
      'Russian analysis must use Cyrillic'
    )
  }
)

Deno.test(
  'Russian Cyrillic permits Latin names and acronyms in otherwise Russian prose',
  () => {
    assertEquals(
      invalidRussianFields({
        translations: {
          ru: ['последствия', 'отголоски', 'послеродовые схватки'],
        },
        examples: [{ ru: 'Компания Apple использует Wi-Fi и USB.' }],
        usage_notes: {
          contrasts: [{ example: { ru: 'Что значит «naweeën»?' } }],
        },
      }),
      []
    )
  }
)

Deno.test(
  'Script guard preserves optional Russian fields and ignores other languages',
  () => {
    for (const value of [
      null,
      {},
      {
        translations: { en: ['house'], ru: [] },
        examples: [{ nl: 'huis', en: 'house' }],
      },
      {
        translations: { ru: [''] },
        examples: [{ ru: null }],
        usage_notes: null,
      },
    ]) {
      assertEquals(invalidRussianFields(value), [])
    }
  }
)
