import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Platform,
  ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { supabase, type User } from '@/lib/supabaseClient'
import { userService } from '@/lib/supabase'
import { Colors } from '@/constants/Colors'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { ROUTES } from '@/constants/Routes'
import { useSimpleAuth } from '@/contexts/SimpleAuthProvider'

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light'
  const [user, setUser] = useState<User | null>(null)
  const { signOut, loading: authLoading } = useSimpleAuth()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const getAppVersion = () => {
    const version = Constants.expoConfig?.version || '1.0.0'
    const buildNumber =
      Platform.OS === 'ios'
        ? Constants.expoConfig?.ios?.buildNumber
        : Constants.expoConfig?.android?.versionCode

    return buildNumber ? `${version} (${buildNumber})` : version
  }

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut()
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
                      ToastService.show(
                        'Account deleted successfully',
                        ToastType.SUCCESS
                      )

                      // Navigate to log in after a short delay
                      setTimeout(() => {
                        console.log('🔄 Navigating to login screen')
                        router.replace(ROUTES.AUTH.LOGIN)
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
                      ToastService.show(errorMessage, ToastType.ERROR)
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
    <ViewThemed style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ViewThemed
          style={styles.section}
          lightColor={Colors.background.secondary}
          darkColor={Colors.dark.backgroundSecondary}
        >
          <TextThemed style={styles.sectionTitle}>Account</TextThemed>

          <TouchableOpacity
            style={[
              styles.logoutButton,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? Colors.dark.error
                    : Colors.error.DEFAULT,
                opacity: authLoading ? 0.7 : 1,
              },
            ]}
            onPress={handleLogout}
            disabled={authLoading}
          >
            <TextThemed style={styles.logoutButtonText}>
              {authLoading ? 'Logging out...' : 'Logout'}
            </TextThemed>
          </TouchableOpacity>

          <TextThemed
            style={styles.logoutDescription}
            lightColor={Colors.neutral[600]}
            darkColor={Colors.dark.textSecondary}
          >
            This will clear your session and return you to the login screen.
          </TextThemed>

          <TouchableOpacity
            style={[
              styles.deleteAccountButton,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? Colors.dark.error
                    : Colors.error.DEFAULT,
                borderColor:
                  colorScheme === 'dark'
                    ? Colors.dark.error
                    : Colors.error.DEFAULT,
              },
            ]}
            onPress={handleDeleteAccount}
          >
            <TextThemed style={styles.deleteAccountButtonText}>
              Delete Account
            </TextThemed>
          </TouchableOpacity>

          <TextThemed
            style={[
              styles.deleteAccountDescription,
              {
                color:
                  colorScheme === 'dark'
                    ? Colors.dark.error
                    : Colors.error.DEFAULT,
              },
            ]}
          >
            Permanently delete your account and all data. This action cannot be
            undone.
          </TextThemed>
        </ViewThemed>

        <ViewThemed
          style={styles.section}
          lightColor={Colors.background.secondary}
          darkColor={Colors.dark.backgroundSecondary}
        >
          <TextThemed style={styles.sectionTitle}>User Information</TextThemed>
          {user?.email && (
            <ViewThemed style={styles.userInfoContainer}>
              <TextThemed
                style={styles.userInfoLabel}
                lightColor={Colors.neutral[600]}
                darkColor={Colors.dark.textSecondary}
              >
                Email:
              </TextThemed>
              <TextThemed style={styles.userInfoValue}>{user.email}</TextThemed>
            </ViewThemed>
          )}
        </ViewThemed>

        <ViewThemed
          style={styles.section}
          lightColor={Colors.background.secondary}
          darkColor={Colors.dark.backgroundSecondary}
        >
          <TextThemed style={styles.sectionTitle}>About</TextThemed>
          <ViewThemed style={styles.appInfoContainer}>
            <TextThemed
              style={styles.appInfoLabel}
              lightColor={Colors.neutral[600]}
              darkColor={Colors.dark.textSecondary}
            >
              De Woordenaar
            </TextThemed>
            <TextThemed style={styles.appInfoVersion}>
              Version {getAppVersion()}
            </TextThemed>
          </ViewThemed>
        </ViewThemed>
      </ScrollView>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  logoutButton: {
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
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteAccountButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
  },
  deleteAccountButtonText: {
    color: Colors.background.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountDescription: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  debugText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  userInfoContainer: {
    marginBottom: 8,
  },
  userInfoLabel: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '500',
  },
  userInfoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  appInfoContainer: {
    alignItems: 'center',
  },
  appInfoLabel: {
    fontSize: 16,
    marginBottom: 4,
    textAlign: 'center',
  },
  appInfoVersion: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
})
