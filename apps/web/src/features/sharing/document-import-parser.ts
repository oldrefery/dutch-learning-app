import { parseDictionaryCollectionExportV2 } from '@woordenaar/domain'
import {
  MAX_TRANSFER_TEXT_LENGTH,
  parseTransferText,
} from './dictionary-transfer-contract'

/** The legacy request endpoint still accepts schema1 only. */
export function parseDocumentImportText(text: string) {
  if (text.length > MAX_TRANSFER_TEXT_LENGTH)
    throw new Error('This JSON export is too large to paste.')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return parseTransferText(text)
  }
  return value &&
    typeof value === 'object' &&
    'schema_version' in value &&
    value.schema_version === 2
    ? parseDictionaryCollectionExportV2(value)
    : parseTransferText(text)
}
