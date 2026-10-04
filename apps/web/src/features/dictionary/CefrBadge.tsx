import { Badge } from '@/components/ui/Badge'
import type { DictionaryCardMetadata } from './content'

export function CefrBadge({
  dictionary,
}: {
  dictionary?: DictionaryCardMetadata
}) {
  if (!dictionary) return null
  const { level, status } = dictionary.cefr
  const label =
    level === null
      ? 'CEFR unknown'
      : `${level}${status === 'estimated' ? ' · estimated' : ' · reviewed'}`
  return (
    <Badge tone={status === 'reviewed' ? 'success' : 'neutral'}>{label}</Badge>
  )
}
