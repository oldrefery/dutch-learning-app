'use client'

import { analyzeWordWithAi } from './analysis-client'
import { normalizeDutchInput } from './analysis-contract'
import { lookupPublishedMeanings } from './dictionary-meaning-lookup'

export async function analyzeForCollection(
  userId: string,
  input: string,
  followingEnabled: boolean
) {
  const { value, error } = normalizeDutchInput(input)
  if (error) throw new Error(error)
  if (followingEnabled) {
    const lookup = (word: string) =>
      lookupPublishedMeanings(userId, word, true, () => {}, true)
    const document = await lookup(value)
    if (document.entries.length) return { kind: 'published', document } as const
    const noun = /^(de|het) (.+)$/i.exec(value)
    if (noun) {
      const candidates = await lookup(noun[2])
      const entries = candidates.entries.filter(
        ({ content }) => content.article === noun[1].toLowerCase()
      )
      if (entries.length)
        return {
          kind: 'published',
          document: { ...candidates, entries },
        } as const
    }
  }
  const result = await analyzeWordWithAi(userId, value)
  return { kind: 'analysis', ...result } as const
}
