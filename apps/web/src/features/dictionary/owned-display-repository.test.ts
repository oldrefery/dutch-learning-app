/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import type { Database } from '@woordenaar/supabase-contracts'
import { createClient } from '@/lib/supabase/server'
import { getOwnedCollectionDetail } from '@/features/collections/repository'
import { getInsightsData } from '@/features/insights/repository'
import { getOwnedReviewWordDetail } from '@/features/review/details-repository'
import { searchOwnedWords } from '@/features/search/repository'
import { getOwnedWordPageData } from '@/features/words/repository'
import { createWordRow, effectiveCard } from './__fixtures__/cards'
import { followingBatch } from './__fixtures__/following'
import {
  listOwnedDisplayWords,
  readOwnedDisplayWord,
} from './owned-display-repository'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const { createClient: createSdkClient } = jest.requireActual<
  typeof import('@supabase/supabase-js')
>('@supabase/supabase-js')

const linked = createWordRow({
  dutch_lemma: 'old storage key',
  translations: { en: ['stale'] },
  repetition_count: 8,
  interval_days: 7,
})
const privateWord = createWordRow({
  word_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  dutch_lemma: 'privé',
  translations: { en: ['private'] },
})
const collectionId = linked.collection_id!
const collection = { collection_id: collectionId, name: 'Home' }
const contentFlag = 'DICTIONARY_CONTENT_ENABLED'
const followingFlag = 'DICTIONARY_FOLLOWING_ENABLED'
const metadataFlag = 'DICTIONARY_WEB_METADATA_READS_ENABLED'
const flags = [contentFlag, followingFlag, metadataFlag] as const
const original = flags.map(flag => process.env[flag])
const v2 = '/rest/v1/rpc/get_dictionary_effective_content_v2'
const wordPath = '/rest/v1/words'
const rows = [linked, privateWord]
const requests: URL[] = []

const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

function content(ids: string[]) {
  const batch = followingBatch(ids.filter(id => id !== privateWord.word_id))
  if (!ids.includes(privateWord.word_id)) return batch
  const privateCard = {
    word_id: privateWord.word_id,
    mode: 'legacy',
    content_version: '0',
    reference: null,
    adopted_revision_id: null,
    head_sequence: null,
    legacy_content: {
      ...effectiveCard().content,
      dutch_lemma: privateWord.dutch_lemma,
      translations: privateWord.translations,
      examples: [],
    },
    removed_fields: [],
    cefr: { level: null, status: 'unknown', confidence: null },
  }
  return { ...batch, cards: [...batch.cards, privateCard] }
}

function makeClient(
  words = rows,
  override?: (url: URL, ids: string[]) => Response | undefined
) {
  const client = createSdkClient<Database>(
    'http://fixture.invalid',
    'fixture',
    {
      auth: { persistSession: false },
      global: {
        fetch: async (input, init) => {
          const url = new URL(String(input))
          requests.push(url)
          const ids = JSON.parse(String(init?.body ?? '{}')).p_word_ids ?? []
          const custom = override?.(url, ids)
          if (custom) return custom
          if (url.pathname === v2) return response(content(ids))
          if (
            url.pathname === '/rest/v1/rpc/get_dictionary_effective_content_v1'
          )
            return response({
              protocol_version: 1,
              cards: ids.map(effectiveCard),
            })
          const fields = url.searchParams.get('select') ?? ''
          const selected =
            url.pathname === wordPath
              ? words
                  .filter(row => {
                    const filter = url.searchParams.get('word_id')
                    return !filter || filter === 'eq.' + row.word_id
                  })
                  .slice(
                    Number(url.searchParams.get('offset') ?? 0),
                    Number(url.searchParams.get('offset') ?? 0) +
                      Number(url.searchParams.get('limit') ?? words.length)
                  )
              : [collection]
          return response(
            fields === '*'
              ? selected
              : selected.map(row =>
                  Object.fromEntries(
                    Object.entries(row).filter(([key]) =>
                      fields.split(',').includes(key)
                    )
                  )
                )
          )
        },
      },
    }
  )
  jest.mocked(createClient).mockResolvedValue(client)
  return client
}

beforeEach(() => {
  requests.length = 0
  for (const flag of flags) process.env[flag] = 'true'
})
afterAll(() => {
  flags.forEach((flag, index) => {
    const value = original[index]
    if (value === undefined) delete process.env[flag]
    else process.env[flag] = value
  })
})

it('routes five screens through owned metadata and resolves public and private content', async () => {
  makeClient()
  const owner = linked.user_id
  const [page, review, detail, results, insights] = await Promise.all([
    getOwnedWordPageData(owner, collectionId, linked.word_id),
    getOwnedReviewWordDetail(owner, privateWord.word_id),
    getOwnedCollectionDetail(owner, collectionId),
    searchOwnedWords(owner, 'dwelling'),
    getInsightsData(owner),
  ])
  expect(page?.word).toMatchObject({
    id: linked.word_id,
    collectionId,
    dutchLemma: 'huis',
    translations: { en: ['dwelling'] },
    repetitionCount: 8,
    intervalDays: 7,
    dictionary: { mode: 'follow' },
  })
  expect(review).toMatchObject({
    id: privateWord.word_id,
    dutchLemma: 'privé',
    translations: { en: ['private'] },
    dictionary: { mode: 'legacy' },
  })
  expect(detail?.words.map(word => [word.id, word.translation])).toEqual([
    [linked.word_id, 'dwelling'],
    [privateWord.word_id, 'private'],
  ])
  expect(results.map(word => word.wordId)).toEqual([linked.word_id])
  expect(insights.words.map(word => [word.word_id, word.dutch_lemma])).toEqual([
    [linked.word_id, 'huis'],
    [privateWord.word_id, 'privé'],
  ])
  expect(insights.words[0]).not.toHaveProperty('dictionary')
  const reads = requests.filter(url => url.pathname === wordPath)
  expect(reads).toHaveLength(5)
  for (const { searchParams } of reads) {
    expect(searchParams.get('select')).not.toMatch(
      /\*|dutch_lemma|translations|image_url/
    )
    expect(searchParams.get('user_id')).toBe('eq.' + owner)
    expect(searchParams.get('deleted_at')).toBe('is.null')
  }
  expect(
    reads.filter(url => url.searchParams.has('collection_id'))
  ).toHaveLength(2)
  expect(requests.filter(url => url.pathname === v2)).toHaveLength(5)
})

it('pages metadata and keeps dictionary requests batched with stable ordering', async () => {
  const many = Array.from({ length: 1001 }, (_, index) =>
    createWordRow({
      word_id: `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString(16).padStart(12, '0')}`,
    })
  )
  const requested: string[][] = []
  const client = makeClient(many, (url, ids) => {
    if (url.pathname === v2) requested.push(ids)
    return undefined
  })
  const words = await listOwnedDisplayWords(client, linked.user_id, {
    view: 'search',
  })
  expect(words.map(word => word.word_id)).toEqual(
    many.map(word => word.word_id)
  )
  expect(requested.map(ids => ids.length)).toEqual([1000, 1])
  expect(
    requests
      .filter(url => url.pathname === wordPath)
      .map(url => [
        url.searchParams.get('offset'),
        url.searchParams.get('order'),
      ])
  ).toEqual([
    ['0', 'dutch_lemma.asc,word_id.asc'],
    ['500', 'dutch_lemma.asc,word_id.asc'],
    ['1000', 'dutch_lemma.asc,word_id.asc'],
  ])
})

it('returns null for a missing word without resolving any content', async () => {
  const client = makeClient([])
  await expect(
    readOwnedDisplayWord(client, linked.user_id, linked.word_id)
  ).resolves.toBeNull()
  expect(requests.map(url => url.pathname)).toEqual([wordPath])
})

it.each(['PGRST202', '42501', 'incomplete'])(
  'fails without rereading stale copies when enabled content returns %s',
  async code => {
    const client = makeClient(rows, url => {
      if (url.pathname !== v2) return undefined
      return code === 'incomplete'
        ? response(followingBatch([]))
        : response({ code, message: 'fixture failure' }, 400)
    })
    await expect(
      readOwnedDisplayWord(client, linked.user_id, linked.word_id)
    ).rejects.toThrow(/dictionary content/i)
    expect(requests.map(url => url.pathname)).toEqual([wordPath, v2])
  }
)

it.each([metadataFlag, followingFlag, contentFlag])(
  'uses the previous reader when %s is disabled',
  async flag => {
    delete process.env[flag]
    const client = makeClient()
    const word = await readOwnedDisplayWord(
      client,
      linked.user_id,
      linked.word_id
    )
    expect(requests[0].searchParams.get('select')).toBe('*')
    expect(word?.translations).toMatchObject({
      en: [flag === contentFlag ? 'stale' : 'dwelling'],
    })
    expect(requests.slice(1).map(url => url.pathname)).toEqual(
      flag === contentFlag
        ? []
        : [
            flag === followingFlag
              ? '/rest/v1/rpc/get_dictionary_effective_content_v1'
              : v2,
          ]
    )
    const requestCount = requests.length
    expect(
      (await getInsightsData(linked.user_id)).words[0].translations
    ).toEqual(linked.translations)
    expect(
      requests.slice(requestCount).some(url => url.pathname.includes('/rpc/'))
    ).toBe(false)
  }
)
