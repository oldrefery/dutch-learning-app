import { contentHash, normalize } from './snapshot.mjs'
import { matchEvidence } from './lexicon.mjs'

const expressions = new Set([
  'idiom',
  'proverb',
  'saying',
  'collocation',
  'phrase',
  'fixed_expression',
])
const lexicalPos = new Set(['noun', 'verb', 'adjective', 'adverb'])
const protectedDisposition = 'protected-collection'

export function exclusionCandidate(card, protectedId) {
  if (card.collection_id === protectedId) return protectedDisposition
  const type = normalize(card.expression_type ?? '')
  const pos = normalize(card.part_of_speech)
  const singleWord = !/\s/u.test(card.dutch_lemma.trim())
  if (type === 'compound' && singleWord && lexicalPos.has(pos))
    return 'lexical-compound-candidate'
  if (expressions.has(type)) return 'expression-candidate'
  if (card.is_expression || pos === 'expression' || !singleWord)
    return 'needs-review'
  return 'vocabulary-candidate'
}

function counts(items, getKey) {
  return items.reduce((result, item) => {
    const key = getKey(item)
    result[key] = (result[key] ?? 0) + 1
    return result
  }, {})
}

function duplicateGroups(cards) {
  const groups = new Map()
  for (const card of cards) {
    const key = JSON.stringify([
      normalize(card.dutch_lemma),
      normalize(card.part_of_speech),
    ])
    groups.set(key, [...(groups.get(key) ?? []), card.word_id])
  }
  return [...groups.values()].filter(ids => ids.length > 1)
}

export function buildReport(snapshot, lexicon, options) {
  const cards = snapshot.cards.map(card => {
    const disposition = exclusionCandidate(card, options.protectedId)
    return {
      wordId: card.word_id,
      collectionId: card.collection_id,
      updatedAt: card.updated_at,
      inputHash: contentHash(card),
      lemma: card.dutch_lemma,
      partOfSpeech: card.part_of_speech,
      translations: card.translations,
      disposition,
      decisionStatus:
        disposition === protectedDisposition
          ? 'excluded-by-user'
          : 'provisional',
      evidence:
        disposition === protectedDisposition
          ? null
          : matchEvidence(card, lexicon),
    }
  })
  const considered = cards.filter(
    card => card.disposition !== protectedDisposition
  )
  return {
    schemaVersion: 1,
    methodVersion: 'vocabulary-evidence-v1',
    snapshotCapturedAt: snapshot.capturedAt,
    snapshotSha256: options.snapshotSha256,
    source: {
      name: 'NT2Lex-CGN-v01',
      sha256: options.sourceSha256,
      url: 'https://cental.uclouvain.be/cefrlex/nt2lex/download/',
      attribution: 'Tack, Francois, Desmet and Fairon (2018), NT2Lex',
      license: 'CC BY-NC-SA 4.0; local analysis only; not bundled in the app',
    },
    summary: {
      cards: cards.length,
      collections: snapshot.collections.length,
      sharedCollections: snapshot.collections.filter(
        collection => collection.is_shared
      ).length,
      unassignedCards: cards.filter(card => card.collectionId === null).length,
      dispositions: counts(cards, card => card.disposition),
      sourceMatchesOutsideProtected: counts(
        considered,
        card => card.evidence.matchType
      ),
      estimatedCefrAssigned: 0,
      finalizedEligibleCards: null,
      productionWrites: 0,
    },
    duplicateLemmaPosGroups: duplicateGroups(snapshot.cards),
    collections: snapshot.collections,
    cards,
  }
}
