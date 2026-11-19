import { render, screen } from '@testing-library/react'
import { createWordRow } from '@/features/dictionary/__fixtures__/cards'
import { buildWordDetail } from './word-detail'
import { WordDetailCard } from './WordDetailCard'

it.each([
  ['december', 'de', 'december'],
  ['dinsdag', 'de', 'dinsdag'],
  ['Januari', 'de', 'Januari'],
  ['maand', 'de', 'de maand'],
  ['huis', 'het', 'het huis'],
])('renders the right headword for %s', (lemma, article, heading) => {
  const row = createWordRow({
    dutch_lemma: lemma,
    article,
    tts_url: '',
    image_url: null,
  })

  render(<WordDetailCard word={buildWordDetail(row)} />)

  expect(screen.getByRole('heading', { name: heading })).toBeVisible()
})
