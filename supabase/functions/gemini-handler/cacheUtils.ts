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
 * Now supports semantic uniqueness based on a lemma + part_of_speech + article
 */
export async function getCachedAnalysis(
  normalizedWord: string,
  partOfSpeech?: string,
  article?: string
): Promise<CacheEntry | null> {
  try {
    // For semantic cache lookup, we need to check the specific combination
    const normalizedPartOfSpeech = partOfSpeech || 'unknown'
    const normalizedArticle = article || ''

    const { data, error } = await supabase
      .from('word_analysis_cache')
      .select('*')
      .eq('dutch_lemma', normalizedWord)
      .eq('part_of_speech', normalizedPartOfSpeech)
      .eq('article', normalizedArticle)
      .gte(
        'last_used_at',
        new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      ) // 180 days TTL (based on last usage, not creation)
      .order('last_used_at', { ascending: false })
      .limit(1)

    if (error) {
      return null
    }

    if (data && data.length > 0) {
      // Update usage statistics
      await updateCacheUsage(data[0].cache_id)
      return data[0] as CacheEntry
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * Get all cached variants of a word (by lemma only) - for showing suggestions
 * when user inputs word without an article
 */
export async function getCachedVariants(
  normalizedWord: string
): Promise<CacheEntry[]> {
  try {
    const { data, error } = await supabase
      .from('word_analysis_cache')
      .select('*')
      .eq('dutch_lemma', normalizedWord)
      .gte(
        'last_used_at',
        new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      ) // 180 days TTL (based on last usage, not creation)
      .order('usage_count', { ascending: false })

    if (error) {
      console.error('❌ getCachedVariants error:', error)
      return []
    }

    console.log(
      `🔍 getCachedVariants result for "${normalizedWord}":`,
      data?.length || 0,
      'variants'
    )
    if (data && data.length > 0) {
      console.log(
        'Variants:',
        data.map(v => ({
          part_of_speech: v.part_of_speech,
          article: v.article,
          usage_count: v.usage_count,
        }))
      )
    }

    return (data || []) as CacheEntry[]
  } catch (error) {
    console.error('❌ getCachedVariants exception:', error)
    return []
  }
}

/**
 * Update cache usage statistics for a specific entry
 */
async function updateCacheUsage(cacheId: string): Promise<void> {
  try {
    await supabase
      .from('word_analysis_cache')
      .update({
        usage_count: supabase.rpc('increment_usage'),
        last_used_at: new Date().toISOString(),
      })
      .eq('cache_id', cacheId)
  } catch (error) {
    // Silent fail
  }
}

/**
 * Save word analysis to cache
 * Now supports semantic uniqueness based on a lemma + part_of_speech + article
 */
export async function saveToCache(
  analysisData: WordAnalysisData
): Promise<void> {
  try {
    // Try to insert a new record
    const { error: insertError } = await supabase
      .from('word_analysis_cache')
      .insert({
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
        // Cache management fields
        usage_count: 1,
        last_used_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    // If the record already exists (duplicate key error), update with fresh data
    if (insertError && insertError.code === '23505') {
      console.log(
        `📝 Record exists, updating with fresh data: ${analysisData.dutch_lemma}`
      )
      const { error: updateError } = await supabase
        .from('word_analysis_cache')
        .update({
          // Update ALL analysis fields with fresh data
          dutch_original: analysisData.dutch_original,
          is_irregular: analysisData.is_irregular,
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
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('dutch_lemma', analysisData.dutch_lemma)
        .eq('part_of_speech', analysisData.part_of_speech)
        .eq('article', analysisData.article || null)

      if (updateError) {
        console.error('❌ saveToCache update error:', updateError)
        throw updateError
      }
    } else if (insertError) {
      // Other errors should be thrown
      console.error('❌ saveToCache insert error:', insertError)
      throw insertError
    }

    console.log(`✅ Saved to cache: ${analysisData.dutch_lemma}`)
  } catch (error) {
    console.error('❌ saveToCache exception:', error)
    throw error
  }
}

/**
 * Normalize word for a cache key (consistent with client-side normalization)
 */
export function normalizeWord(word: string): string {
  return word.trim().toLowerCase()
}
