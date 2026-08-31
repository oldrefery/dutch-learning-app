import type { ReviewInsightWord } from '@woordenaar/domain'
import type { Json } from '@woordenaar/supabase-contracts'

export interface InsightWord extends ReviewInsightWord {
  article: string | null
  collection_id: string | null
  dutch_original: string | null
  part_of_speech: string | null
  translations: Json
}

export interface InsightCollection {
  id: string
  name: string
}

export interface InsightsData {
  collections: InsightCollection[]
  words: InsightWord[]
}
