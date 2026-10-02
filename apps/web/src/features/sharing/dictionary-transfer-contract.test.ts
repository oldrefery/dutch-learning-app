/** @jest-environment node */
import {
  buildTransferPreview,
  MAX_TRANSFER_TEXT_LENGTH,
  parseTransferCommand,
  parseTransferReply,
  parseTransferText,
  requestDictionaryTransfer,
} from './dictionary-transfer-contract'
import {
  content,
  document,
  importCommand,
  OTHER_OWNER,
  savedReply,
} from './__fixtures__/dictionary-transfer'

it('validates a self-contained document and exact owner/target/selection envelope', () => {
  expect(parseTransferText(JSON.stringify(document))).toEqual(document)
  expect(parseTransferCommand(importCommand)).toEqual(importCommand)
})
it.each([
  { ...importCommand, ownerId: 'invalid' },
  { ...importCommand, collectionId: 'new' },
  { ...importCommand, selectedIndexes: [] },
  { ...importCommand, selectedIndexes: [0, 0] },
  { ...importCommand, selectedIndexes: [1] },
  { ...importCommand, selectedIndexes: [-1] },
  { ...importCommand, selectedIndexes: [0.5] },
  { ...importCommand, selectedIndexes: ['0'] },
  { ...importCommand, original_intent: { word_id: 'retained' } },
  { ...importCommand, document: { ...document, schema_version: 2 } },
  {
    ...importCommand,
    document: {
      ...document,
      entries: [{ content, reference: { entry_id: 'private' } }],
    },
  },
  {
    ...importCommand,
    document: {
      ...document,
      entries: [{ content: { ...content, interval_days: 30 } }],
    },
  },
])('rejects unsafe or ambiguous commands', value => {
  expect(() => parseTransferCommand(value)).toThrow()
})
it('bounds pasted text before JSON parsing', () => {
  expect(() =>
    parseTransferText(' '.repeat(MAX_TRANSFER_TEXT_LENGTH + 1))
  ).toThrow('too large')
  expect(() => parseTransferText('{')).toThrow('schema-v1')
})
it('previews global owned and within-document duplicates using semantic keys', () => {
  const words = buildTransferPreview(
    { ...document, entries: [...document.entries, ...document.entries] },
    []
  )
  expect(words.map(word => word.duplicate)).toEqual([false, true])
  expect(words[1].duplicateCollection).toBe('this export')
  expect(
    buildTransferPreview(document, [
      {
        dutchLemma: content.dutch_lemma.toUpperCase(),
        article: content.article,
        partOfSpeech: content.part_of_speech,
        collectionName: 'Elsewhere',
      },
    ])[0]
  ).toMatchObject({ duplicate: true, duplicateCollection: 'Elsewhere' })
})
it.each([
  { ...savedReply, savedCount: -1 },
  { ...savedReply, ownerId: 'invalid' },
  { ...savedReply, cacheRefreshed: 'yes' },
])('rejects malformed success receipts', value => {
  expect(() => parseTransferReply(value)).toThrow()
})
it('uses an explicit same-origin POST and refuses a success belonging to another owner', async () => {
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({ ok: true, json: async () => savedReply } as Response)
  try {
    await expect(requestDictionaryTransfer(importCommand)).resolves.toEqual(
      savedReply
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dictionary-transfer',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify(importCommand),
      })
    )
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ...savedReply, ownerId: OTHER_OWNER }),
    } as Response)
    await expect(requestDictionaryTransfer(importCommand)).rejects.toThrow()
  } finally {
    fetchMock.mockRestore()
  }
})
