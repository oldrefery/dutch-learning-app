import { createHash } from 'node:crypto'
import {
  parseDictionaryContent,
  parseDictionaryRevision,
} from '../../packages/domain/src/shared-dictionary.ts'

const stable = value =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map(key => [key, stable(value[key])])
        )
      : value

export const publicationHash = value =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex')

export function publicationContentHashes(content) {
  const { image_url, tts_url, ...assessmentContent } = content
  return {
    content_sha256: publicationHash(content),
    cefr_input_sha256: publicationHash({
      assessment_schema_version: 1,
      content: assessmentContent,
    }),
  }
}

/** Complete representation only; never invent conjugations or replace owner text.
 * A prefix completion must be explicitly reviewed by the packet author. */
export function prepareOwnerPublicationContent(original, prefixCompletion) {
  const content = structuredClone(original)
  const changes = []
  if (
    content.conjugation &&
    !Object.hasOwn(content.conjugation, 'simple_past_plural')
  ) {
    content.conjugation.simple_past_plural = null
    changes.push('conjugation.simple_past_plural: absent -> null')
  }
  for (const key of ['dutch_original', 'analysis_notes']) {
    if (content[key] === '') {
      content[key] = null
      changes.push(`${key}: empty -> null`)
    }
  }
  if (prefixCompletion) {
    const { lemma, root, prefix } = prefixCompletion
    const exampleTokens = content.examples.flatMap(
      example => example.nl.toLowerCase().match(/\p{L}+/gu) ?? []
    )
    if (
      content.dutch_lemma !== lemma ||
      content.root_verb !== root ||
      content.is_separable !== true ||
      content.prefix_part !== null ||
      typeof prefix !== 'string' ||
      prefix.length === 0 ||
      prefix + root !== lemma ||
      !exampleTokens.includes(prefix)
    ) {
      throw new Error(
        'Reviewed prefix completion does not match owner evidence'
      )
    }
    content.prefix_part = prefix
    changes.push(`prefix_part: null -> ${prefix}`)
  }
  const parsed = parseDictionaryContent(content)
  if (!parsed.success) {
    throw new Error(
      `Invalid owner publication content: ${JSON.stringify(parsed.issues)}`
    )
  }
  return { content, changes, ...publicationContentHashes(content) }
}

/** Validate the complete client envelope, including hashes, before binding SQL. */
export function qualifyOwnerPublicationRevision(revision) {
  const parsed = parseDictionaryRevision(revision)
  if (!parsed.success) {
    throw new Error(`Invalid client revision: ${JSON.stringify(parsed.issues)}`)
  }
  const hashes = publicationContentHashes(revision.content)
  if (
    revision.content_sha256 !== hashes.content_sha256 ||
    revision.cefr_input_sha256 !== hashes.cefr_input_sha256
  ) {
    throw new Error('Owner publication hash mismatch')
  }
  return parsed.data
}
