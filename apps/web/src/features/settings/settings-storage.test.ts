import {
  DEFAULT_WEB_SETTINGS,
  normalizeWebSettings,
  parseWebSettings,
} from './settings-storage'

describe('web settings storage', () => {
  it('normalizes persisted preferences', () => {
    expect(
      normalizeWebSettings({
        adaptiveReviewEnabled: false,
        autoPlayPronunciation: true,
        lastSelectedCollectionId: 'collection-1',
        lastSelectedReviewMode: 'adaptive',
        theme: 'dark',
      })
    ).toEqual({
      adaptiveReviewEnabled: false,
      autoPlayPronunciation: true,
      lastSelectedCollectionId: 'collection-1',
      lastSelectedReviewMode: 'meaning-recall',
      theme: 'dark',
    })
  })

  it('falls back safely for malformed browser data', () => {
    expect(parseWebSettings('{')).toEqual(DEFAULT_WEB_SETTINGS)
    expect(
      normalizeWebSettings({
        adaptiveReviewEnabled: 'yes',
        lastSelectedReviewMode: 'unknown',
        theme: 'sepia',
      })
    ).toEqual(DEFAULT_WEB_SETTINGS)
  })
})
