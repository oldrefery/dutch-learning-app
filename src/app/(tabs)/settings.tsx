import React from 'react'
import { StyleSheet, TouchableOpacity, Alert, Button } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { supabase } from '@/lib/supabaseClient'
import { userService } from '@/lib/supabase'
import { Colors } from '@/constants/Colors'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'

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
              ToastService.showError(ToastMessageType.LOGOUT_FAILED)
              return
            }

            // Navigate to login
            router.replace('/(auth)/login')
          } catch {
            ToastService.showError(ToastMessageType.LOGOUT_FAILED)
          }
        },
      },
    ])
  }

  const handleDeleteAccount = async () => {
    // First confirmation - explain what will happen
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data, including:\n\n• All your saved words and collections\n• Your learning progress\n• Account information\n\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            // Second confirmation - final warning
            Alert.alert(
              'Are you absolutely sure?',
              'Your account and all data will be permanently deleted. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete My Account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      console.log('🎯 User confirmed account deletion')
                      await userService.deleteAccount()

                      console.log('✅ Showing success toast')
                      ToastService.showSuccess(ToastMessageType.ACCOUNT_DELETED)

                      // Navigate to login after a short delay
                      setTimeout(() => {
                        console.log('🔄 Navigating to login screen')
                        router.replace('/(auth)/login')
                      }, 2000)
                    } catch (error) {
                      console.error(
                        '💥 UI error during account deletion:',
                        error
                      )
                      const errorMessage =
                        error instanceof Error
                          ? error.message
                          : 'Unknown error occurred'
                      ToastService.showError(
                        ToastMessageType.ACCOUNT_DELETE_FAILED,
                        errorMessage
                      )
                    }
                  },
                },
              ]
            )
          },
        },
      ]
    )
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

          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
          >
            <TextThemed style={styles.deleteAccountButtonText}>
              Delete Account
            </TextThemed>
          </TouchableOpacity>

          <TextThemed style={styles.deleteAccountDescription}>
            Permanently delete your account and all data. This action cannot be
            undone.
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
    marginBottom: 20,
  },
  deleteAccountButton: {
    backgroundColor: Colors.error.DEFAULT,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.error.DEFAULT,
  },
  deleteAccountButtonText: {
    color: Colors.background.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountDescription: {
    fontSize: 12,
    color: Colors.error.DEFAULT,
    textAlign: 'center',
    fontWeight: '500',
  },
  debugText: {
    fontSize: 14,
    color: Colors.neutral[600],
    fontStyle: 'italic',
  },
})
