import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Platform,
  ScrollView,
  Image,
  Linking,
  Switch,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { PlatformBlurView } from '@/components/PlatformBlurView'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { supabase, type User } from '@/lib/supabaseClient'
import { userService } from '@/lib/supabase'
import { Colors } from '@/constants/Colors'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { ROUTES } from '@/constants/Routes'
import { useSimpleAuth } from '@/contexts/SimpleAuthProvider'
import { Sentry } from '@/lib/sentry'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { syncManager } from '@/services/syncManager'
import { wordRepository } from '@/db/wordRepository'

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

const executeDeleteAccount = async () => {
  try {
    await userService.deleteAccount()

    ToastService.show('Account deleted successfully', ToastType.SUCCESS)

    setTimeout(() => {
      router.replace(ROUTES.AUTH.LOGIN)
    }, 2000)
  } catch (error) {
    Sentry.captureException(
      error instanceof Error
        ? error
        : new Error('UI error during account deletion'),
      {
        tags: { operation: 'deleteAccount' },
      }
    )
    ToastService.show(
      getErrorMessage(error, 'Unknown error occurred'),
      ToastType.ERROR
    )
  }
}

const showDeleteAccountConfirmation = (onConfirmDelete: () => void) => {
  Alert.alert(
    'Delete Account',
    'This will permanently delete your account and all your data, including:\n\n• All your saved words and collections\n• Your learning progress\n• Account information\n\nThis action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Are you absolutely sure?',
            'Your account and all data will be permanently deleted. This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete My Account',
                style: 'destructive',
                onPress: onConfirmDelete,
              },
            ]
          )
        },
      },
    ]
  )
}

const handleForceSyncAction = async (
  currentUserId: string | null,
  isSyncing: boolean,
  setIsSyncing: (value: boolean) => void
) => {
  if (!currentUserId || isSyncing) {
    ToastService.show('Sync unavailable. Please try again.', ToastType.ERROR)
    return
  }

  setIsSyncing(true)
  try {
    const result = await syncManager.performSync(currentUserId)
    if (result.success) {
      ToastService.show('Sync completed.', ToastType.SUCCESS)
    } else {
      ToastService.show(result.error ?? 'Sync failed.', ToastType.ERROR)
    }
  } catch (error) {
    ToastService.show(
      getErrorMessage(error, 'Sync failed. Please try again.'),
      ToastType.ERROR
    )
  } finally {
    setIsSyncing(false)
  }
}

const deleteRemoteOrphanWords = async (
  userId: string
): Promise<{ count: number }> => {
  const { data: collections, error: collectionsError } = await supabase
    .from('collections')
    .select('collection_id')
    .eq('user_id', userId)

  if (collectionsError) {
    throw new Error(`Failed to load collections: ${collectionsError.message}`)
  }

  const collectionIds = new Set(
    (collections ?? []).map(collection => collection.collection_id)
  )

  const { data: words, error: wordsError } = await supabase
    .from('words')
    .select('word_id, collection_id')
    .eq('user_id', userId)

  if (wordsError) {
    throw new Error(`Failed to load words: ${wordsError.message}`)
  }

  const orphanWordIds = (words ?? [])
    .filter(
      word => !word.collection_id || !collectionIds.has(word.collection_id)
    )
    .map(word => word.word_id)

  if (orphanWordIds.length === 0) {
    return { count: 0 }
  }

  const chunkSize = 100
  for (let i = 0; i < orphanWordIds.length; i += chunkSize) {
    const chunk = orphanWordIds.slice(i, i + chunkSize)
    const { error: deleteError } = await supabase
      .from('words')
      .delete()
      .in('word_id', chunk)

    if (deleteError) {
      throw new Error(`Failed to delete words: ${deleteError.message}`)
    }
  }

  return { count: orphanWordIds.length }
}

const executeDeleteOrphanWords = async (currentUserId: string) => {
  try {
    const localResult = await wordRepository.deleteOrphanWords(currentUserId)
    const remoteResult = await deleteRemoteOrphanWords(currentUserId)
    const totalRemoved = localResult.count + remoteResult.count

    if (totalRemoved > 0) {
      ToastService.show(
        `Removed ${localResult.count} local and ${remoteResult.count} remote orphan word${
          totalRemoved > 1 ? 's' : ''
        }.`,
        ToastType.SUCCESS
      )
    } else {
      ToastService.show('No orphan words found.', ToastType.INFO)
    }
  } catch (error) {
    ToastService.show(
      getErrorMessage(error, 'Failed to delete orphan words.'),
      ToastType.ERROR
    )
  }
}

const promptDeleteOrphanWords = (currentUserId: string | null) => {
  if (!currentUserId) {
    ToastService.show('No user available for cleanup.', ToastType.ERROR)
    return
  }

  Alert.alert(
    'Delete Orphan Words',
    'This will remove words not linked to any collection (local + remote).',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void executeDeleteOrphanWords(currentUserId)
        },
      },
    ]
  )
}

const executeDeleteWordByLemma = async (
  currentUserId: string,
  input?: string
) => {
  const normalizedLemma = (input ?? '').trim().toLowerCase()
  if (!normalizedLemma) {
    ToastService.show('Lemma is required.', ToastType.ERROR)
    return
  }

  try {
    const { data: words, error } = await supabase
      .from('words')
      .select('word_id')
      .eq('user_id', currentUserId)
      .eq('dutch_lemma', normalizedLemma)

    if (error) {
      throw new Error(`Lookup failed: ${error.message}`)
    }

    if (!words || words.length === 0) {
      ToastService.show('Word not found.', ToastType.INFO)
      return
    }

    const wordIds = words.map(word => word.word_id)
    const chunkSize = 100
    for (let i = 0; i < wordIds.length; i += chunkSize) {
      const chunk = wordIds.slice(i, i + chunkSize)
      const { error: deleteError } = await supabase
        .from('words')
        .delete()
        .in('word_id', chunk)

      if (deleteError) {
        throw new Error(`Delete failed: ${deleteError.message}`)
      }
    }

    for (const wordId of wordIds) {
      await wordRepository.deleteWord(wordId, currentUserId)
    }

    ToastService.show(
      `Removed ${wordIds.length} word${wordIds.length > 1 ? 's' : ''}.`,
      ToastType.SUCCESS
    )
  } catch (error) {
    ToastService.show(
      getErrorMessage(error, 'Failed to delete word.'),
      ToastType.ERROR
    )
  }
}

const promptDeleteWordByLemma = (currentUserId: string | null) => {
  if (!currentUserId) {
    ToastService.show('No user available for cleanup.', ToastType.ERROR)
    return
  }

  Alert.prompt(
    'Delete Word By Lemma',
    'Enter the lemma to remove (local + remote).',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: (input?: string) => {
          void executeDeleteWordByLemma(currentUserId, input)
        },
      },
    ],
    'plain-text'
  )
}

const getAppVersion = () => {
  const version = Constants.expoConfig?.version || '1.0.0'
  const buildNumber =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode

  return buildNumber ? `${version} (${buildNumber})` : version
}

const getBlurTint = (isDarkMode: boolean): 'light' | 'dark' =>
  isDarkMode ? 'dark' : 'light'

const getSectionSurfaceStyle = (isDarkMode: boolean) => ({
  backgroundColor: isDarkMode
    ? Colors.transparent.iosDarkSurface95
    : Colors.transparent.white95,
  borderColor: isDarkMode
    ? Colors.transparent.white10
    : Colors.transparent.black05,
})

const getSeparatorColor = (isDarkMode: boolean) =>
  isDarkMode ? Colors.transparent.white10 : Colors.transparent.black05

const getAppIconSource = (isDarkMode: boolean) =>
  isDarkMode
    ? require('@/assets/icons/ios-dark.png')
    : require('@/assets/icons/ios-light.png')

const getDestructiveColor = (isDarkMode: boolean) =>
  isDarkMode ? Colors.dark.error : Colors.error.DEFAULT

const getAccessBadgeBackgroundColor = (
  userAccessLevel: string,
  isDarkMode: boolean
) => {
  if (userAccessLevel === 'full_access') {
    return isDarkMode ? Colors.success.darkModeChip : Colors.success.DEFAULT
  }

  return isDarkMode ? Colors.warning.darkModeBadge : Colors.warning.DEFAULT
}

const getAccessBadgeTextColor = (userAccessLevel: string) =>
  userAccessLevel === 'full_access'
    ? Colors.success.darkModeChipText
    : Colors.warning.darkModeBadgeText

const getAccessBadgeLabel = (userAccessLevel: string) =>
  userAccessLevel === 'full_access' ? 'Full Access' : 'Read Only'

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const colorScheme = useColorScheme() ?? 'light'
  const [user, setUser] = useState<User | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const { signOut, loading: authLoading } = useSimpleAuth()
  const { userAccessLevel, currentUserId } = useApplicationStore()
  const { autoPlayPronunciation, setAutoPlayPronunciation } = useSettingsStore()

  const isDarkMode = colorScheme === 'dark'
  const blurTint = getBlurTint(isDarkMode)
  const sectionSurfaceStyle = getSectionSurfaceStyle(isDarkMode)
  const separatorColor = getSeparatorColor(isDarkMode)
  const appIconSource = getAppIconSource(isDarkMode)
  const destructiveColor = getDestructiveColor(isDarkMode)
  const logoutLabel = authLoading ? 'Logging out...' : 'Logout'
  const forceSyncLabel = isSyncing ? 'Syncing...' : 'Force Sync (Debug)'

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

  const handleDeleteAccount = () => {
    showDeleteAccountConfirmation(() => {
      void executeDeleteAccount()
    })
  }

  const handleForceSync = async () => {
    await handleForceSyncAction(currentUserId, isSyncing, setIsSyncing)
  }

  const handleDeleteOrphanWords = () => {
    promptDeleteOrphanWords(currentUserId)
  }

  const handleDeleteWordByLemma = () => {
    promptDeleteWordByLemma(currentUserId)
  }

  return (
    <ViewThemed
      testID="screen-settings"
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 80, // Add extra space for tab bar
        },
      ]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ViewThemed style={styles.aboutSectionContainer}>
          <PlatformBlurView
            style={styles.aboutBlur}
            intensity={100}
            tint={blurTint}
            blurMethod={'dimezisBlurView'}
          >
            <ViewThemed style={[styles.aboutSection, sectionSurfaceStyle]}>
              <ViewThemed
                style={styles.appInfoContainer}
                lightColor="transparent"
                darkColor="transparent"
              >
                <Image source={appIconSource} style={styles.appIcon} />
                <TextThemed style={styles.appName}>De Woordenaar</TextThemed>
                <TextThemed
                  style={styles.appDescription}
                  lightColor={Colors.neutral[600]}
                  darkColor={Colors.dark.textSecondary}
                >
                  Learn Dutch with AI-powered flashcards
                </TextThemed>
                <TextThemed
                  style={styles.appVersion}
                  lightColor={Colors.neutral[500]}
                  darkColor={Colors.dark.textSecondary}
                >
                  Version {getAppVersion()}
                </TextThemed>
              </ViewThemed>

              <ViewThemed
                style={[
                  styles.separator,
                  {
                    backgroundColor: separatorColor,
                  },
                ]}
              />

              <ViewThemed
                style={styles.linksContainer}
                lightColor="transparent"
                darkColor="transparent"
              >
                <TouchableOpacity
                  style={styles.linkItem}
                  onPress={() => {
                    Linking.openURL(
                      'https://www.termsfeed.com/live/3e576e8c-54c9-4543-b808-890d7c98f662'
                    )
                  }}
                >
                  <TextThemed
                    style={styles.linkText}
                    lightColor={Colors.primary.DEFAULT}
                    darkColor={Colors.primary.darkMode}
                  >
                    Privacy Policy
                  </TextThemed>
                </TouchableOpacity>

                <ViewThemed
                  style={[
                    styles.linkSeparator,
                    {
                      backgroundColor: separatorColor,
                    },
                  ]}
                />

                <TouchableOpacity
                  style={styles.linkItem}
                  onPress={() => {
                    Linking.openURL(
                      'https://www.termsfeed.com/live/855aec0d-a235-42e8-af6f-28166c93901a'
                    )
                  }}
                >
                  <TextThemed
                    style={styles.linkText}
                    lightColor={Colors.primary.DEFAULT}
                    darkColor={Colors.primary.darkMode}
                  >
                    Terms and Conditions
                  </TextThemed>
                </TouchableOpacity>

                <ViewThemed
                  style={[
                    styles.linkSeparator,
                    {
                      backgroundColor: separatorColor,
                    },
                  ]}
                />

                <TouchableOpacity
                  style={styles.linkItem}
                  onPress={() => {
                    Linking.openURL(
                      'http://www.apple.com/legal/itunes/appstore/dev/stdeula'
                    )
                  }}
                >
                  <TextThemed
                    style={styles.linkText}
                    lightColor={Colors.primary.DEFAULT}
                    darkColor={Colors.primary.darkMode}
                  >
                    License Agreement
                  </TextThemed>
                </TouchableOpacity>

                <ViewThemed
                  style={[
                    styles.linkSeparator,
                    {
                      backgroundColor: separatorColor,
                    },
                  ]}
                />

                <TouchableOpacity
                  style={styles.linkItem}
                  onPress={() => {
                    Alert.alert(
                      'Credits',
                      'Built with:\n\n• React Native & Expo\n• Supabase\n• Google Gemini AI\n• Unsplash API\n\nDeveloped with passion for language learning',
                      [{ text: 'OK' }]
                    )
                  }}
                >
                  <TextThemed
                    style={styles.linkText}
                    lightColor={Colors.primary.DEFAULT}
                    darkColor={Colors.primary.darkMode}
                  >
                    Credits & Acknowledgements
                  </TextThemed>
                </TouchableOpacity>
              </ViewThemed>
            </ViewThemed>
          </PlatformBlurView>
        </ViewThemed>

        <ViewThemed style={styles.userInfoSectionContainer}>
          <PlatformBlurView
            style={styles.userInfoBlur}
            intensity={100}
            tint={blurTint}
            blurMethod={'dimezisBlurView'}
          >
            <ViewThemed style={[styles.userInfoSection, sectionSurfaceStyle]}>
              <ViewThemed
                style={styles.sectionHeader}
                lightColor="transparent"
                darkColor="transparent"
              >
                <TextThemed style={styles.sectionTitle}>
                  User Information
                </TextThemed>
                {userAccessLevel && (
                  <ViewThemed
                    style={[
                      styles.accessBadge,
                      {
                        backgroundColor: getAccessBadgeBackgroundColor(
                          userAccessLevel,
                          isDarkMode
                        ),
                      },
                    ]}
                  >
                    <TextThemed
                      style={styles.accessBadgeText}
                      lightColor={Colors.background.primary}
                      darkColor={getAccessBadgeTextColor(userAccessLevel)}
                    >
                      {getAccessBadgeLabel(userAccessLevel)}
                    </TextThemed>
                  </ViewThemed>
                )}
              </ViewThemed>
              {user?.email && (
                <ViewThemed
                  style={styles.userInfoRow}
                  lightColor="transparent"
                  darkColor="transparent"
                >
                  <TextThemed
                    style={styles.userInfoLabel}
                    lightColor={Colors.neutral[600]}
                    darkColor={Colors.dark.textSecondary}
                  >
                    Email:
                  </TextThemed>
                  <TextThemed
                    style={styles.userInfoValue}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {user.email}
                  </TextThemed>
                </ViewThemed>
              )}
            </ViewThemed>
          </PlatformBlurView>
        </ViewThemed>
        <ViewThemed style={styles.preferencesSectionContainer}>
          <PlatformBlurView
            style={styles.preferencesBlur}
            intensity={100}
            tint={blurTint}
            blurMethod={'dimezisBlurView'}
          >
            <ViewThemed
              style={[styles.preferencesSection, sectionSurfaceStyle]}
            >
              <TextThemed style={styles.sectionTitle}>Preferences</TextThemed>

              <ViewThemed
                style={styles.preferenceRow}
                lightColor="transparent"
                darkColor="transparent"
              >
                <ViewThemed
                  style={styles.preferenceTextContainer}
                  lightColor="transparent"
                  darkColor="transparent"
                >
                  <TextThemed style={styles.preferenceLabel}>
                    Auto-play Pronunciation
                  </TextThemed>
                  <TextThemed
                    style={styles.preferenceDescription}
                    lightColor={Colors.neutral[600]}
                    darkColor={Colors.dark.textSecondary}
                  >
                    Automatically play word pronunciation when a card is shown
                  </TextThemed>
                </ViewThemed>
                <Switch
                  testID="auto-play-pronunciation-switch"
                  value={autoPlayPronunciation}
                  onValueChange={setAutoPlayPronunciation}
                  trackColor={{
                    false: isDarkMode
                      ? Colors.neutral[700]
                      : Colors.neutral[300],
                    true: Colors.primary.DEFAULT,
                  }}
                  thumbColor={
                    autoPlayPronunciation
                      ? Colors.background.primary
                      : isDarkMode
                        ? Colors.neutral[400]
                        : Colors.background.primary
                  }
                />
              </ViewThemed>
            </ViewThemed>
          </PlatformBlurView>
        </ViewThemed>

        <ViewThemed style={styles.accountSectionContainer}>
          <PlatformBlurView
            style={styles.accountBlur}
            intensity={100}
            tint={blurTint}
            blurMethod={'dimezisBlurView'}
          >
            <ViewThemed style={[styles.accountSection, sectionSurfaceStyle]}>
              <TextThemed style={styles.sectionTitle}>Account</TextThemed>

              <TouchableOpacity
                style={[
                  styles.logoutButton,
                  {
                    backgroundColor: destructiveColor,
                    opacity: authLoading ? 0.7 : 1,
                  },
                ]}
                onPress={handleLogout}
                disabled={authLoading}
              >
                <TextThemed style={styles.logoutButtonText}>
                  {logoutLabel}
                </TextThemed>
              </TouchableOpacity>

              {__DEV__ && (
                <>
                  <TouchableOpacity
                    testID="force-sync-button"
                    style={[
                      styles.forceSyncButton,
                      {
                        backgroundColor: Colors.primary.DEFAULT,
                        opacity: isSyncing ? 0.7 : 1,
                      },
                    ]}
                    onPress={handleForceSync}
                    disabled={isSyncing}
                  >
                    <TextThemed style={styles.forceSyncButtonText}>
                      {forceSyncLabel}
                    </TextThemed>
                  </TouchableOpacity>

                  <TextThemed
                    style={styles.logoutDescription}
                    lightColor={Colors.neutral[600]}
                    darkColor={Colors.dark.textSecondary}
                  >
                    Runs a manual sync and logs stage output for debugging.
                  </TextThemed>

                  <TouchableOpacity
                    testID="delete-orphan-words-button"
                    style={[
                      styles.forceSyncButton,
                      {
                        backgroundColor: Colors.warning.DEFAULT,
                      },
                    ]}
                    onPress={handleDeleteOrphanWords}
                  >
                    <TextThemed style={styles.forceSyncButtonText}>
                      Delete Orphan Words (Debug)
                    </TextThemed>
                  </TouchableOpacity>

                  <TextThemed
                    style={styles.logoutDescription}
                    lightColor={Colors.neutral[600]}
                    darkColor={Colors.dark.textSecondary}
                  >
                    Removes orphan words from local DB and Supabase.
                  </TextThemed>

                  <TouchableOpacity
                    testID="delete-word-by-lemma-button"
                    style={[
                      styles.forceSyncButton,
                      {
                        backgroundColor: Colors.error.DEFAULT,
                      },
                    ]}
                    onPress={handleDeleteWordByLemma}
                  >
                    <TextThemed style={styles.forceSyncButtonText}>
                      Delete Word By Lemma (Debug)
                    </TextThemed>
                  </TouchableOpacity>

                  <TextThemed
                    style={styles.logoutDescription}
                    lightColor={Colors.neutral[600]}
                    darkColor={Colors.dark.textSecondary}
                  >
                    Removes a word by lemma from local DB and Supabase.
                  </TextThemed>
                </>
              )}

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
                    backgroundColor: destructiveColor,
                    borderColor: destructiveColor,
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
                    color: destructiveColor,
                  },
                ]}
              >
                Permanently delete your account and all data. This action cannot
                be undone.
              </TextThemed>
            </ViewThemed>
          </PlatformBlurView>
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
    padding: 16,
    paddingTop: 12,
  },
  section: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  aboutSectionContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  aboutBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  aboutSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  userInfoSectionContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  userInfoBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  userInfoSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  preferencesSectionContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  preferencesBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  preferencesSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  preferenceTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  accountSectionContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  accountBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  accountSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  accessBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  accessBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
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
  forceSyncButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  forceSyncButtonText: {
    color: Colors.background.primary,
    fontSize: 16,
    fontWeight: '600',
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
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  userInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  appInfoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: 14,
    marginBottom: 10,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  appDescription: {
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  appVersion: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  separator: {
    height: 1,
    marginBottom: 10,
  },
  linksContainer: {
    gap: 0,
  },
  linkItem: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkSeparator: {
    height: 1,
    marginHorizontal: 16,
  },
})
