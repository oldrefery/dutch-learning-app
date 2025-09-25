import React from 'react'
import { ActivityIndicator, useColorScheme, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface SharedCollectionLoadingScreenProps {
  title?: string
  message?: string
}

export function SharedCollectionLoadingScreen({
  title = 'Shared Collection',
  message = 'Loading shared collection...',
}: SharedCollectionLoadingScreenProps) {
  const colorScheme = useColorScheme() ?? 'light'

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.backgroundSecondary
                : Colors.background.secondary,
          },
        }}
      />
      <ViewThemed style={styles.container}>
        <ActivityIndicator
          size="large"
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
        <TextThemed style={styles.message}>{message}</TextThemed>
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
  message: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
})
