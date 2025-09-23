import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Supabase client for cache operations (using a service role)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface CacheEntry {
  cache_id: string
  dutch_original: string
  dutch_lemma: string
  part_of_speech: string
  is_irregular: boolean
  article: string | null
  is_reflexive: boolean
  is_expression: boolean
  expression_type: string | null
  is_separable: boolean
  prefix_part: string | null
  root_verb: string | null
  translations: any
  examples: any[]
  tts_url: string | null
  image_url: string | null
  synonyms: any[]
  antonyms: any[]
  plural: string | null
  conjugation: any | null
  preposition: string | null
  analysis_notes: string
  usage_count: number
  created_at: string
  last_used_at: string
}

export interface WordAnalysisData {
  dutch_original: string
  dutch_lemma: string
  part_of_speech: string
  is_irregular: boolean
  article?: string
  is_reflexive: boolean
  is_expression: boolean
  expression_type?: string
  is_separable: boolean
  prefix_part?: string
  root_verb?: string
  translations: any
  examples: any[]
  tts_url?: string
  image_url?: string
  synonyms: any[]
  antonyms: any[]
  plural?: string
  conjugation?: any
  preposition?: string
  analysis_notes: string
}

/**
 * Get cached word analysis if it exists and is still valid
 */
export async function getCachedAnalysis(
  normalizedWord: string
): Promise<CacheEntry | null> {
  try {
    const { data, error } = await supabase.rpc('get_valid_cache_entry', {
      lemma: normalizedWord,
    })

    if (error) {
      console.error('❌ Cache lookup error:', error)
      return null
    }

    if (data && data.length > 0) {
      // Update usage statistics
      await supabase.rpc('increment_cache_usage', { lemma: normalizedWord })
      return data[0] as CacheEntry
    }

    return null
  } catch (error) {
    console.error('❌ Cache check error:', error)
    return null
  }
}

/**
 * Save word analysis to cache
 */
export async function saveToCache(
  analysisData: WordAnalysisData
): Promise<void> {
  try {
    const { error } = await supabase.from('word_analysis_cache').upsert(
      {
        dutch_lemma: analysisData.dutch_lemma,
        dutch_original: analysisData.dutch_original,
        part_of_speech: analysisData.part_of_speech,
        is_irregular: analysisData.is_irregular,
        article: analysisData.article || null,
        is_reflexive: analysisData.is_reflexive,
        is_expression: analysisData.is_expression,
        expression_type: analysisData.expression_type || null,
        is_separable: analysisData.is_separable,
        prefix_part: analysisData.prefix_part || null,
        root_verb: analysisData.root_verb || null,
        translations: analysisData.translations,
        examples: analysisData.examples,
        tts_url: analysisData.tts_url || null,
        image_url: analysisData.image_url || null,
        synonyms: analysisData.synonyms,
        antonyms: analysisData.antonyms,
        plural: analysisData.plural || null,
        conjugation: analysisData.conjugation || null,
        preposition: analysisData.preposition || null,
        analysis_notes: analysisData.analysis_notes,
        // Cache management fields will use defaults
        usage_count: 1,
        last_used_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'dutch_lemma',
        ignoreDuplicates: false,
      }
    )

    if (error) {
      console.error('❌ Cache save error:', error)
    }
  } catch (error) {
    console.error('❌ Cache save error:', error)
  }
}

/**
 * Normalize word for a cache key (consistent with client-side normalization)
 */
export function normalizeWord(word: string): string {
  return word.trim().toLowerCase()
}
