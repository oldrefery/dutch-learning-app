import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface WordAnalysisResponse {
  lemma: string
  part_of_speech: string
  is_irregular?: boolean
  is_reflexive?: boolean
  is_expression?: boolean
  expression_type?: 'idiom' | 'phrase' | 'collocation' | 'compound'
  article?: 'de' | 'het'
  translations: {
    en: string[]
    ru: string[]
  }
  examples: Array<{
    nl: string
    en: string
    ru: string
  }>
  tts_url?: string
  image_url?: string
}

interface Word {
  word_id: string
  dutch_lemma: string
  part_of_speech: string
  is_irregular?: boolean | null
  is_reflexive?: boolean | null
  is_expression?: boolean | null
  expression_type?: string | null
  article?: string | null
  image_url?: string | null
  translations: any
}

// Helper function to get image for word
async function getImageForWord(
  englishTranslation: string,
  partOfSpeech: string
): Promise<string | null> {
  try {
    const unsplashKey = Deno.env.get('UNSPLASH_ACCESS_KEY')

    if (!unsplashKey) {
      console.log('No Unsplash key, using Lorem Picsum fallback')
      // Fallback to Lorem Picsum if no Unsplash key
      const searchTerm = englishTranslation.toLowerCase()
      let hash = 0
      for (let i = 0; i < searchTerm.length; i++) {
        const char = searchTerm.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash
      }
      const imageId = (Math.abs(hash) % 1000) + 1
      return `https://picsum.photos/600/400?random=${imageId}`
    }

    const searchTerm = englishTranslation.toLowerCase()
    const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&client_id=${unsplashKey}&per_page=1&orientation=landscape`

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`)
    }

    const data = await response.json()
    if (data.results && data.results.length > 0) {
      const photo = data.results[0]
      return photo.urls.regular || photo.urls.small
    }

    // Fallback to Lorem Picsum if no results
    const hash = englishTranslation.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0)
      return a & a
    }, 0)
    const imageId = (Math.abs(hash) % 1000) + 1
    return `https://picsum.photos/600/400?random=${imageId}`
  } catch (error) {
    console.warn('Failed to fetch image:', error)
    // Final fallback
    const hash = englishTranslation.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0)
      return a & a
    }, 0)
    const imageId = (Math.abs(hash) % 1000) + 1
    return `https://picsum.photos/600/400?random=${imageId}`
  }
}

// Helper function to call Gemini for comprehensive word analysis
async function analyzeWordComprehensively(
  word: string
): Promise<Partial<WordAnalysisResponse>> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const prompt = `Analyze this Dutch word/expression comprehensively and provide detailed information.

Word/Expression: "${word}"

Respond with valid JSON in this exact format:
{
  "lemma": "word_lemma",
  "part_of_speech": "noun|verb|adjective|adverb|preposition|conjunction|interjection|expression|other",
  "article": "de|het",
  "is_irregular": false,
  "is_reflexive": false,
  "is_expression": false,
  "expression_type": "idiom|phrase|collocation|compound"
}

Analysis rules:
1. **Articles (nouns only)**: Use "de" for common gender, "het" for neuter
2. **Irregular verbs**: Set is_irregular=true for irregular conjugations
3. **Reflexive verbs**: Set is_reflexive=true for verbs used with "zich" (e.g., "zich wassen")
4. **Expressions**: Set is_expression=true for:
   - idioms: "de kat uit de boom kijken" 
   - phrases: "goedemorgen zeggen"
   - collocations: "koffie drinken"
   - compounds: if it's multiple words forming one concept
5. **Expression types**: Only include if is_expression=true

Examples:
- "kat" → {"lemma": "kat", "part_of_speech": "noun", "article": "de"}
- "lopen" → {"lemma": "lopen", "part_of_speech": "verb"}  
- "zijn" → {"lemma": "zijn", "part_of_speech": "verb", "is_irregular": true}
- "zich wassen" → {"lemma": "zich wassen", "part_of_speech": "verb", "is_reflexive": true}
- "de kat uit de boom kijken" → {"lemma": "de kat uit de boom kijken", "part_of_speech": "expression", "is_expression": true, "expression_type": "idiom"}

Only include fields that apply - omit others.
`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.candidates[0].content.parts[0].text

    // Clean the response text
    const cleanedText = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/^\s*```json\s*/gm, '')
      .replace(/^\s*```\s*/gm, '')
      .trim()

    const analysisResult = JSON.parse(cleanedText)
    return analysisResult
  } catch (error) {
    console.error('Error calling Gemini API:', error)
    throw error
  }
}

serve(async req => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, target = 'all' } = await req.json()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const results = {
      action,
      target,
      processed: 0,
      updated: 0,
      errors: 0,
      details: [] as string[],
    }

    if (action === 'migrate_all' || action === 'migrate_missing') {
      // Get all words to check for missing fields
      const { data: words, error } = await supabase.from('words').select('*')

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      if (!words || words.length === 0) {
        results.details.push('No words found in database')
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      results.details.push(`Found ${words.length} words to analyze`)

      for (const word of words) {
        try {
          results.processed++

          // Check what fields are missing
          const missingFields = []
          const updates: any = {}

          // Check article for nouns
          if (
            word.part_of_speech === 'noun' &&
            (!word.article || word.article === '')
          ) {
            missingFields.push('article')
          }

          // Check image
          if (!word.image_url || word.image_url === '') {
            missingFields.push('image_url')
          }

          // Check new fields (these will be null for existing words)
          if (word.is_reflexive === null || word.is_reflexive === undefined) {
            missingFields.push('is_reflexive')
          }

          if (word.is_expression === null || word.is_expression === undefined) {
            missingFields.push('is_expression')
          }

          // If no missing fields, skip
          if (missingFields.length === 0) {
            results.details.push(`✅ ${word.dutch_lemma} - all fields complete`)
            continue
          }

          results.details.push(
            `🔄 ${word.dutch_lemma} - missing: ${missingFields.join(', ')}`
          )

          // Get comprehensive analysis from Gemini
          const analysis = await analyzeWordComprehensively(word.dutch_lemma)

          // Update missing fields based on analysis
          if (missingFields.includes('article') && analysis.article) {
            updates.article = analysis.article
          }

          if (missingFields.includes('is_reflexive')) {
            updates.is_reflexive = analysis.is_reflexive || false
          }

          if (missingFields.includes('is_expression')) {
            updates.is_expression = analysis.is_expression || false
          }

          if (analysis.expression_type && analysis.is_expression) {
            updates.expression_type = analysis.expression_type
          }

          // Get image if missing
          if (missingFields.includes('image_url')) {
            const translations = word.translations
            const englishTranslations = translations?.en || []

            if (englishTranslations.length > 0) {
              const primaryTranslation = englishTranslations[0]
              const imageUrl = await getImageForWord(
                primaryTranslation,
                word.part_of_speech
              )
              if (imageUrl) {
                updates.image_url = imageUrl
              }
            }
          }

          // Apply updates if any
          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from('words')
              .update(updates)
              .eq('word_id', word.word_id)

            if (updateError) {
              results.errors++
              results.details.push(
                `❌ Error updating ${word.dutch_lemma}: ${updateError.message}`
              )
            } else {
              results.updated++
              const updatedFields = Object.keys(updates).join(', ')
              results.details.push(
                `✅ Updated ${word.dutch_lemma}: ${updatedFields}`
              )
            }
          }

          // Delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          results.errors++
          results.details.push(
            `❌ Error processing ${word.dutch_lemma}: ${error.message}`
          )
        }
      }
    } else if (action === 'migrate_images') {
      // Get all words without images
      const { data: words, error } = await supabase
        .from('words')
        .select('*')
        .or('image_url.is.null,image_url.eq.')

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      if (!words || words.length === 0) {
        results.details.push('No words without images found')
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      results.details.push(`Found ${words.length} words without images`)

      for (const word of words) {
        try {
          results.processed++

          // Get primary English translation
          const translations = word.translations
          const englishTranslations = translations?.en || []

          if (englishTranslations.length > 0) {
            const primaryTranslation = englishTranslations[0]
            const imageUrl = await getImageForWord(
              primaryTranslation,
              word.part_of_speech
            )

            if (imageUrl) {
              // Update the word with the image
              const { error: updateError } = await supabase
                .from('words')
                .update({ image_url: imageUrl })
                .eq('word_id', word.word_id)

              if (updateError) {
                results.errors++
                results.details.push(
                  `Error updating image for ${word.dutch_lemma}: ${updateError.message}`
                )
              } else {
                results.updated++
                results.details.push(`Added image for ${word.dutch_lemma}`)
              }
            }
          } else {
            results.details.push(
              `No English translation found for ${word.dutch_lemma}`
            )
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          results.errors++
          results.details.push(
            `Error processing image for ${word.dutch_lemma}: ${error.message}`
          )
        }
      }
    } else {
      throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Migration function error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        action: 'unknown',
        processed: 0,
        updated: 0,
        errors: 1,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
