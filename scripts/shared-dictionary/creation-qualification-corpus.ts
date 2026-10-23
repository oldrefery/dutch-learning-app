import {
  qualificationCorpus,
  type QualificationCase,
} from './semantic-qualification-corpus.ts'

// Creation-only revision. Preserve the measured direct-analysis corpus verbatim.
export function creationQualificationCorpus(): QualificationCase[] {
  const corpus = qualificationCorpus().filter(
    row => !['positive-notes-3', 'positive-notes-4'].includes(row.id)
  )
  // Retain all prior negatives/uncertain/guards. Two redundant noun-note positives
  // make room for isolated person-mismatch negatives within the same 48-call cap.
  const walk = corpus.find(row => row.id === 'expanded-positive-lopen')!
  for (const [field, value] of [
    ['present', 'loopt'],
    ['simple_past', 'liepen'],
  ] as const) {
    const item = structuredClone(walk)
    item.id = `creation-negative-ik-${field.replaceAll('_', '-')}`
    item.category = 'negative'
    item.expected = 'different-meaning'
    item.dimensions = ['grammar']
    item.rationale =
      'Only this conjugation field changes: a non-first-person-singular form contradicts the ik field and the explicit protected grammar.'
    item.content.conjugation = { ...walk.content.conjugation!, [field]: value }
    corpus.push(item)
  }
  // All variants of this expression must share the same enriched anchor and
  // component metadata; otherwise a negative sense case has a second confound.
  for (const item of corpus) {
    if (item.input.entry.lemma !== 'de knoop doorhakken') continue
    item.input.anchor.gloss +=
      ' Its verbal component doorhakken is separable: hakt de knoop door, hakte de knoop door, de knoop doorgehakt; prefix door and root hakken.'
    item.content.is_separable = true
    item.content.prefix_part = 'door'
    item.content.root_verb = 'hakken'
  }
  return corpus
}
