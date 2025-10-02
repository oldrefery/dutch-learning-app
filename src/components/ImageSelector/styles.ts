import { StyleSheet, Dimensions } from 'react-native'
import { Colors } from '@/constants/Colors'

const { width } = Dimensions.get('window')

export const getImageSelectorStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        colorScheme === 'dark'
          ? Colors.dark.background
          : Colors.light.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor:
        colorScheme === 'dark'
          ? Colors.dark.backgroundSecondary
          : Colors.light.backgroundSecondary,
      borderBottomWidth: 1,
      borderBottomColor:
        colorScheme === 'dark' ? Colors.neutral[700] : Colors.neutral[200],
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
    },
    closeButton: {
      padding: 4,
    },
    subtitle: {
      fontSize: 14,
      color:
        colorScheme === 'dark'
          ? Colors.dark.textSecondary
          : Colors.light.textSecondary,
      textAlign: 'center',
      marginVertical: 16,
      paddingHorizontal: 16,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 16,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      height: 44,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: 16,
    },
    searchButton: {
      backgroundColor: Colors.primary.DEFAULT,
      width: 44,
      height: 44,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      fontSize: 16,
      color:
        colorScheme === 'dark'
          ? Colors.dark.textSecondary
          : Colors.light.textSecondary,
      marginTop: 12,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorText: {
      fontSize: 16,
      color: Colors.error.DEFAULT,
      textAlign: 'center',
      marginBottom: 16,
    },
    retryButton: {
      backgroundColor: Colors.primary.DEFAULT,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '500',
    },
    imageGrid: {
      flex: 1,
      paddingHorizontal: 16,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      paddingBottom: 20,
    },
    imageOption: {
      width: (width - 48) / 2, // 2 columns with padding
      aspectRatio: 1.5,
      marginBottom: 16,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor:
        colorScheme === 'dark'
          ? Colors.dark.backgroundSecondary
          : Colors.light.backgroundSecondary,
      shadowColor:
        colorScheme === 'dark' ? Colors.legacy.black : Colors.legacy.black,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    optionImage: {
      width: '100%',
      height: '100%',
    },
    currentImage: {
      borderWidth: 3,
      borderColor: Colors.success.DEFAULT,
    },
    currentBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor:
        colorScheme === 'dark'
          ? Colors.dark.backgroundSecondary
          : Colors.light.backgroundSecondary,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      shadowColor: Colors.legacy.black,
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    currentText: {
      fontSize: 12,
      fontWeight: '500',
      color: Colors.success.DEFAULT,
      marginLeft: 4,
    },
    loadMoreContainer: {
      padding: 20,
      alignItems: 'center',
    },
    loadMoreButton: {
      backgroundColor: Colors.primary.DEFAULT,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      minWidth: 120,
      alignItems: 'center',
    },
    loadMoreButtonDisabled: {
      backgroundColor: Colors.neutral[400],
    },
    loadMoreText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '500',
    },
  })

// Backward compatibility - default to light theme
export const imageSelectorStyles = getImageSelectorStyles('light')
