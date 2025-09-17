import React from 'react'
import { StyleSheet, TouchableOpacity, Alert, Button } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { supabase } from '@/lib/supabaseClient'
import { Colors } from '@/constants/Colors'

export default function SettingsScreen() {
  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.auth.signOut()

            if (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.')
              return
            }

            // Navigate to login
            router.replace('/(auth)/login')
          } catch {
            Alert.alert('Error', 'An unexpected error occurred.')
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <ViewThemed style={styles.content}>
        <ViewThemed style={styles.header}>
          <TextThemed style={styles.title}>Settings</TextThemed>
          <TextThemed style={styles.subtitle}>
            Manage your account and app preferences
          </TextThemed>
        </ViewThemed>

        <Button
          title="Test Crash"
          onPress={() => {
            throw new Error('Test crash for Sentry')
          }}
        />

        <ViewThemed style={styles.section}>
          <TextThemed style={styles.sectionTitle}>Account</TextThemed>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <TextThemed style={styles.logoutButtonText}>Logout</TextThemed>
          </TouchableOpacity>

          <TextThemed style={styles.logoutDescription}>
            This will clear your session and return you to the login screen.
          </TextThemed>
        </ViewThemed>

        <ViewThemed style={styles.section}>
          <TextThemed style={styles.sectionTitle}>About</TextThemed>
          <TextThemed style={styles.debugText}>
            Dutch Learning App - Version 1.0
          </TextThemed>
        </ViewThemed>
      </ViewThemed>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
    padding: 20,
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: Colors.error.DEFAULT,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutButtonText: {
    color: Colors.background.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutDescription: {
    fontSize: 14,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  debugText: {
    fontSize: 14,
    color: Colors.neutral[600],
    fontStyle: 'italic',
  },
})
