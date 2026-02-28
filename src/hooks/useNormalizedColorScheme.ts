import { useColorScheme as useRNColorScheme } from 'react-native'

/**
 * Wrapper around useColorScheme that normalizes 'unspecified' and null to 'light'.
 * In React Native 0.83+ (SDK 55), useColorScheme can return 'unspecified'.
 */
export function useNormalizedColorScheme(): 'light' | 'dark' {
  const colorScheme = useRNColorScheme()
  return colorScheme === 'dark' ? 'dark' : 'light'
}
