// Build-time opt-in; server capability is checked separately before any sync.
export const isDictionaryContentEnabled = (): boolean =>
  process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED === 'true'
