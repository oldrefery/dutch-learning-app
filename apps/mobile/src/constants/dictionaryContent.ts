// Build-time opt-in; server capability is checked separately before any sync.
export const isDictionaryContentEnabled = (): boolean =>
  process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED === 'true'

export const isDictionaryFollowingEnabled = (): boolean =>
  isDictionaryContentEnabled() &&
  process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED === 'true'

export const isDictionarySharedAnalysisEnabled = (): boolean =>
  isDictionaryFollowingEnabled() &&
  process.env.EXPO_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED === 'true'

export const isDictionaryFollowingImportsEnabled = (): boolean =>
  isDictionaryFollowingEnabled() &&
  process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED === 'true'
