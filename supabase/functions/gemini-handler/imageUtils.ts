import { IMAGE_CONFIG, API_CONFIG } from './constants.ts'

// Helper function to create Lorem Picsum URL with different seeds
export function createPicsumUrl(
  width: number = IMAGE_CONFIG.FALLBACK_IMAGE_WIDTH,
  height: number = IMAGE_CONFIG.FALLBACK_IMAGE_HEIGHT,
  seed?: string
): string {
  const baseUrl = `${API_CONFIG.PICSUM_BASE_URL}/${width}/${height}`
  return seed ? `${baseUrl}?random=${seed}` : baseUrl
}

// Helper function to get preferred Unsplash URL
export function getPreferredUnsplashUrl(photo: any): string {
  // Prefer regular size, fallback to small, then thumb
  return (
    photo.urls?.regular ||
    photo.urls?.small ||
    photo.urls?.thumb ||
    photo.urls?.raw
  )
}

// Helper function to generate image hash for consistent fallback
export function generateImageHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString()
}

// Helper function to get multiple image options for word
export async function getMultipleImagesForWord(
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
        const seed = generateImageHash(`${englishTranslation}-${i}`)
        images.push({
          url: createPicsumUrl(
            IMAGE_CONFIG.FALLBACK_IMAGE_WIDTH,
            IMAGE_CONFIG.FALLBACK_IMAGE_HEIGHT,
            seed
          ),
          alt: `${englishTranslation} - ${partOfSpeech}`,
        })
      }
      return images
    }

    // Use Unsplash API
    const searchQuery = createSmartSearchQuery(
      englishTranslation,
      partOfSpeech,
      examples
    )
    const searchParams = new URLSearchParams({
      query: searchQuery,
      per_page: count.toString(),
      orientation: 'landscape',
      content_filter: 'high',
    })

    const response = await fetch(
      `${API_CONFIG.UNSPLASH_API_URL}?${searchParams}`,
      {
        headers: {
          Authorization: `Client-ID ${unsplashKey}`,
          'Accept-Version': 'v1',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`)
    }

    const data = await response.json()
    const photos = data.results || []

    if (photos.length === 0) {
      // Fallback to Lorem Picsum
      const images = []
      for (let i = 0; i < count; i++) {
        const seed = generateImageHash(`${englishTranslation}-${i}`)
        images.push({
          url: createPicsumUrl(
            IMAGE_CONFIG.FALLBACK_IMAGE_WIDTH,
            IMAGE_CONFIG.FALLBACK_IMAGE_HEIGHT,
            seed
          ),
          alt: `${englishTranslation} - ${partOfSpeech}`,
        })
      }
      return images
    }

    return photos.map((photo: any) => ({
      url: getPreferredUnsplashUrl(photo),
      alt: photo.alt_description || `${englishTranslation} - ${partOfSpeech}`,
    }))
  } catch (error) {
    console.error('Error fetching images:', error)

    // Fallback to Lorem Picsum
    const images = []
    for (let i = 0; i < count; i++) {
      const seed = generateImageHash(`${englishTranslation}-${i}`)
      images.push({
        url: createPicsumUrl(
          IMAGE_CONFIG.FALLBACK_IMAGE_WIDTH,
          IMAGE_CONFIG.FALLBACK_IMAGE_HEIGHT,
          seed
        ),
        alt: `${englishTranslation} - ${partOfSpeech}`,
      })
    }
    return images
  }
}

// Helper function to create smart search query for images
export function createSmartSearchQuery(
  englishTranslation: string,
  partOfSpeech: string,
  examples?: Array<{ nl: string; en: string; ru?: string }>
): string {
  let query = englishTranslation.toLowerCase()

  // Add context from examples if available
  if (examples && examples.length > 0) {
    const contextWords = examples
      .map(ex => ex.en.toLowerCase())
      .join(' ')
      .split(' ')
      .filter(word => word.length > 3)
      .slice(0, 3)

    if (contextWords.length > 0) {
      query += ` ${contextWords.join(' ')}`
    }
  }

  // Add part of speech context
  if (partOfSpeech === 'verb') {
    query += ' action'
  } else if (partOfSpeech === 'noun') {
    query += ' object'
  } else if (partOfSpeech === 'adjective') {
    query += ' descriptive'
  }

  return query
}
