import React from 'react'
import { TouchableOpacity, useColorScheme, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface SharedCollectionErrorScreenProps {
  title?: string
  error: string
  onRetry?: () => void
  onGoBack?: () => void
  showRetry?: boolean
}

export function SharedCollectionErrorScreen({
  title = 'Shared Collection',
  error,
  onRetry,
  onGoBack,
  showRetry = false,
}: SharedCollectionErrorScreenProps) {
  const colorScheme = useColorScheme() ?? 'light'

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerBackVisible: false,
          headerStyle: {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.backgroundSecondary
                : Colors.background.secondary,
          },
        }}
      />
      <ViewThemed style={styles.container}>
        <Ionicons
          name="warning-outline"
          size={64}
          color={
            colorScheme === 'dark'
              ? Colors.dark.textTertiary
              : Colors.neutral[400]
          }
        />
        <TextThemed style={styles.title}>Unable to Load Collection</TextThemed>
        <TextThemed
          style={styles.message}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          {error}
        </TextThemed>

        {showRetry ? (
          <ViewThemed style={styles.buttons}>
            {onGoBack && (
              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor:
                      colorScheme === 'dark'
                        ? Colors.dark.backgroundSecondary
                        : Colors.neutral[200],
                  },
                ]}
                onPress={onGoBack}
              >
                <TextThemed
                  style={styles.buttonText}
                  lightColor={Colors.neutral[700]}
                  darkColor={Colors.dark.text}
                >
                  Browse Collections
                </TextThemed>
              </TouchableOpacity>
            )}
            {onRetry && (
              <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <TextThemed style={styles.retryButtonText}>
                  Try Again
                </TextThemed>
              </TouchableOpacity>
            )}
          </ViewThemed>
        ) : (
          onGoBack && (
            <TouchableOpacity style={styles.singleButton} onPress={onGoBack}>
              <TextThemed style={styles.retryButtonText}>Go Back</TextThemed>
            </TouchableOpacity>
          )
        )}
      </ViewThemed>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.primary.DEFAULT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  singleButton: {
    backgroundColor: Colors.primary.DEFAULT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
})
