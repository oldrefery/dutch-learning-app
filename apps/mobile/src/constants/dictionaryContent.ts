// Build-time opt-in; server capability is checked separately before any sync.
export const isDictionaryContentEnabled = (): boolean =>
  process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED === 'true'

export const isDictionaryFollowingEnabled = (): boolean =>
  isDictionaryContentEnabled() &&
  process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED === 'true'

// Local D14.1 candidate. Requires the separately installed read projection.
export const isDictionaryProjectedWordsEnabled = (): boolean =>
  isDictionaryFollowingEnabled() &&
  process.env.EXPO_PUBLIC_DICTIONARY_PROJECTED_WORDS_ENABLED === 'true'

export const isDictionarySharedAnalysisEnabled = (): boolean =>
  isDictionaryFollowingEnabled() &&
  process.env.EXPO_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED === 'true'

export const isDictionaryFollowingImportsEnabled = (): boolean =>
  isDictionaryFollowingEnabled() &&
  process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED === 'true'

// Local D14.1 candidate; requires the separate local metadata RPC.
export const isDictionaryLightWordsEnabled = (): boolean =>
  isDictionaryFollowingEnabled() &&
  process.env.EXPO_PUBLIC_DICTIONARY_LIGHT_WORDS_ENABLED === 'true'

// Only a completed owner-bound server restore receipt can authorize this return.
export const isDictionaryManagedRecoveryEnabled = (): boolean =>
  isDictionaryFollowingEnabled() &&
  process.env.EXPO_PUBLIC_DICTIONARY_MANAGED_RECOVERY_ENABLED === 'true'
