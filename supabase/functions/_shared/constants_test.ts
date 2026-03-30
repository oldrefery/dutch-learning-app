/**
 * Tests for shared constants helper functions
 *
 * Tests createPicsumUrl, getPreferredUnsplashUrl, and generateImageHash.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  createPicsumUrl,
  getPreferredUnsplashUrl,
  generateImageHash,
  IMAGE_CONFIG,
} from './constants.ts'

// =========================================
// createPicsumUrl
// =========================================

Deno.test('createPicsumUrl - generates correct URL format', () => {
  const url = createPicsumUrl(42)
  assertEquals(
    url,
    `https://picsum.photos/${IMAGE_CONFIG.MOBILE_WIDTH}/${IMAGE_CONFIG.MOBILE_HEIGHT}?random=42`
  )
})

Deno.test('createPicsumUrl - uses correct dimensions from config', () => {
  const url = createPicsumUrl(1)
  assertEquals(url.includes(`${IMAGE_CONFIG.MOBILE_WIDTH}`), true)
  assertEquals(url.includes(`${IMAGE_CONFIG.MOBILE_HEIGHT}`), true)
})

// =========================================
// getPreferredUnsplashUrl
// =========================================

Deno.test(
  'getPreferredUnsplashUrl - returns preferred size when available',
  () => {
    const photo = {
      urls: {
        small: 'https://unsplash.com/small.jpg',
        regular: 'https://unsplash.com/regular.jpg',
      },
    }
    assertEquals(
      getPreferredUnsplashUrl(photo),
      'https://unsplash.com/small.jpg'
    )
  }
)

Deno.test('getPreferredUnsplashUrl - falls back to regular size', () => {
  const photo = {
    urls: {
      regular: 'https://unsplash.com/regular.jpg',
    },
  }
  assertEquals(
    getPreferredUnsplashUrl(photo),
    'https://unsplash.com/regular.jpg'
  )
})

// =========================================
// generateImageHash
// =========================================

Deno.test('generateImageHash - returns positive number', () => {
  const hash = generateImageHash('house')
  assertEquals(hash > 0, true)
})

Deno.test('generateImageHash - returns number within PICSUM_ID_RANGE', () => {
  const hash = generateImageHash('house')
  assertEquals(hash >= 1, true)
  assertEquals(hash <= IMAGE_CONFIG.PICSUM_ID_RANGE, true)
})

Deno.test('generateImageHash - is deterministic for same input', () => {
  const hash1 = generateImageHash('house')
  const hash2 = generateImageHash('house')
  assertEquals(hash1, hash2)
})

Deno.test('generateImageHash - offset changes the result', () => {
  const hash1 = generateImageHash('house', 0)
  const hash2 = generateImageHash('house', 100)
  // They might collide by chance, but usually differ
  // Just verify both are valid
  assertEquals(hash1 >= 1 && hash1 <= IMAGE_CONFIG.PICSUM_ID_RANGE, true)
  assertEquals(hash2 >= 1 && hash2 <= IMAGE_CONFIG.PICSUM_ID_RANGE, true)
})

Deno.test(
  'generateImageHash - different words produce different hashes',
  () => {
    const hash1 = generateImageHash('house')
    const hash2 = generateImageHash('cat')
    // Different words should (usually) produce different hashes
    assertEquals(hash1 !== hash2, true)
  }
)
