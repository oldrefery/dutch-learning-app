import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  IMAGE_CONFIG,
  SEARCH_CONFIG,
  API_CONFIG,
  createPicsumUrl,
  getPreferredUnsplashUrl,
  generateImageHash,
} from '../_shared/constants.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface GetImagesRequest {
  englishTranslation: string
  partOfSpeech: string
  examples?: Array<{
    nl: string
    en: string
    ru?: string
  }>
  count?: number
}

interface ImageOption {
  url: string
  alt: string
}

// Helper function to create smart search queries
function createSmartSearchQuery(
  englishTranslation: string,
  partOfSpeech: string,
  examples?: Array<{ nl: string; en: string; ru?: string }>
): string[] {
  const queries = []
  const baseTranslation = englishTranslation.toLowerCase()

  // Base query
  queries.push(baseTranslation)

  // Smart queries based on part of speech
  switch (partOfSpeech) {
    case 'verb':
      // For verbs, add action context
      if (
        baseTranslation.includes('leave') ||
        baseTranslation.includes('depart')
      ) {
        queries.push(
          'departure train station',
          'leaving journey',
          'travel departure'
        )
      } else if (baseTranslation.includes('walk')) {
        queries.push('person walking', 'walking path', 'pedestrian walking')
      } else if (
        baseTranslation.includes('buy') ||
        baseTranslation.includes('purchase')
      ) {
        queries.push('shopping buying', 'purchase store', 'buying goods')
      } else if (baseTranslation.includes('eat')) {
        queries.push('eating food', 'person eating', 'dining meal')
      } else {
        queries.push(`${baseTranslation} action`, `person ${baseTranslation}`)
      }
      break

    case 'noun':
      // For nouns, be more specific
      if (
        baseTranslation.includes('house') ||
        baseTranslation.includes('home')
      ) {
        queries.push('house building', 'residential home', 'house exterior')
      } else if (baseTranslation.includes('cat')) {
        queries.push('domestic cat', 'house cat', 'cat animal')
      } else if (baseTranslation.includes('book')) {
        queries.push('book reading', 'open book', 'books library')
      } else {
        queries.push(`${baseTranslation} object`, `${baseTranslation} thing`)
      }
      break

    case 'adjective':
      // For adjectives, show the quality
      queries.push(`${baseTranslation} concept`, `${baseTranslation} feeling`)
      break

    default:
      queries.push(`${baseTranslation} concept`)
  }

  // Add context from examples if available
  if (examples && examples.length > 0) {
    const firstExample = examples[0].en.toLowerCase()
    // Extract key words from example
    const contextWords = firstExample
      .split(' ')
      .filter(
        word =>
          word.length > SEARCH_CONFIG.MIN_CONTEXT_WORD_LENGTH &&
          !SEARCH_CONFIG.STOP_WORDS.includes(word)
      )

    if (contextWords.length > 0) {
      const contextWord = contextWords[0]
      queries.push(`${baseTranslation} ${contextWord}`)
    }
  }

  return queries
}

// Helper function to get multiple image options for word
async function getMultipleImagesForWord(
  englishTranslation: string,
  partOfSpeech: string,
  examples?: Array<{ nl: string; en: string; ru?: string }>,
  count: number = IMAGE_CONFIG.DEFAULT_QUERY_COUNT
): Promise<Array<{ url: string; alt: string }>> {
  try {
    const unsplashKey = Deno.env.get('UNSPLASH_ACCESS_KEY')

    if (!unsplashKey) {
      // Fallback to Lorem Picsum with different seeds
      const images = []
      for (let i = 0; i < count; i++) {
        const imageId = generateImageHash(
          englishTranslation.toLowerCase(),
          i * 100
        )
        images.push({
          url: createPicsumUrl(imageId),
          alt: `${englishTranslation} (option ${i + 1})`,
        })
      }
      return images
    }

    // Get smart search queries
    const searchQueries = createSmartSearchQuery(
      englishTranslation,
      partOfSpeech,
      examples
    )
    const images = []

    // Try different search queries until we have enough images
    for (const query of searchQueries) {
      if (images.length >= count) break

      try {
        const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${unsplashKey}&per_page=${count}&orientation=${IMAGE_CONFIG.UNSPLASH.ORIENTATION}`

        const response = await fetch(apiUrl)
        if (!response.ok) continue

        const data = await response.json()

        if (data.results && data.results.length > 0) {
          for (const photo of data.results) {
            if (images.length >= count) break

            // Avoid duplicates and use mobile-optimized sizes
            const url = getPreferredUnsplashUrl(photo)
            if (!images.some(img => img.url === url)) {
              images.push({
                url,
                alt:
                  photo.alt_description || `${englishTranslation} (${query})`,
              })
            }
          }
        }
      } catch (queryError) {
        console.warn(`Query "${query}" failed:`, queryError)
        continue
      }
    }

    // Fill remaining slots with Lorem Picsum if needed
    while (images.length < count) {
      const imageId = generateImageHash(englishTranslation, images.length * 50)
      images.push({
        url: createPicsumUrl(imageId),
        alt: `${englishTranslation} (fallback ${images.length + 1})`,
      })
    }

    return images
  } catch (error) {
    console.warn('Failed to fetch multiple images:', error)
    // Return fallback images
    const images = []
    for (let i = 0; i < count; i++) {
      const imageId = generateImageHash(englishTranslation, i * 25)
      images.push({
        url: createPicsumUrl(imageId),
        alt: `${englishTranslation} (fallback ${i + 1})`,
      })
    }
    return images
  }
}

serve(async req => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      englishTranslation,
      partOfSpeech,
      examples,
      count = IMAGE_CONFIG.DEFAULT_QUERY_COUNT,
    }: GetImagesRequest = await req.json()

    if (!englishTranslation || !partOfSpeech) {
      return new Response(
        JSON.stringify({
          error: 'englishTranslation and partOfSpeech are required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const images = await getMultipleImagesForWord(
      englishTranslation,
      partOfSpeech,
      examples,
      count
    )

    return new Response(JSON.stringify({ images }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Get multiple images error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        images: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
