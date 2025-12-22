/**
 * Notification History Section
 * Shows recent toast notifications with timestamps
 */

import React from 'react'
import { StyleSheet, FlatList, useColorScheme } from 'react-native'
import { PlatformBlurView } from '@/components/PlatformBlurView'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useHistoryStore } from '@/stores/useHistoryStore'
import { ToastType } from '@/constants/ToastConstants'
import { formatRelativeTime } from '@/utils/dateUtils'

export function NotificationHistorySection() {
  const colorScheme = useColorScheme() ?? 'light'
  const notifications = useHistoryStore(state => state.notifications)

  const isDarkMode = colorScheme === 'dark'
  const blurBackgroundDark = Colors.transparent.iosDarkSurface95
  const blurBackgroundLight = Colors.transparent.white95
  const separatorDark = Colors.transparent.white10
  const separatorLight = Colors.transparent.black05

  const getNotificationIcon = (type: ToastType) => {
    switch (type) {
      case ToastType.SUCCESS:
        return '✅'
      case ToastType.ERROR:
        return '❌'
      case ToastType.INFO:
        return 'ℹ️'
      default:
        return '📋'
    }
  }

  const getNotificationColor = (type: ToastType) => {
    switch (type) {
      case ToastType.SUCCESS:
        return colorScheme === 'dark'
          ? Colors.success.dark
          : Colors.success.DEFAULT
      case ToastType.ERROR:
        return colorScheme === 'dark' ? Colors.dark.error : Colors.error.DEFAULT
      case ToastType.INFO:
        return colorScheme === 'dark'
          ? Colors.primary.darkMode
          : Colors.primary.DEFAULT
      default:
        return colorScheme === 'dark'
          ? Colors.dark.textSecondary
          : Colors.neutral[600]
    }
  }

  if (notifications.length === 0) {
    return (
      <ViewThemed style={styles.sectionContainer}>
        <PlatformBlurView
          style={styles.sectionBlur}
          intensity={100}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          experimentalBlurMethod={'dimezisBlurView'}
        >
          <ViewThemed
            style={[
              styles.section,
              {
                backgroundColor: isDarkMode
                  ? blurBackgroundDark
                  : blurBackgroundLight,
                borderColor: isDarkMode ? separatorDark : separatorLight,
              },
            ]}
          >
            <TextThemed style={styles.sectionTitle}>
              Recent Notifications
            </TextThemed>
            <TextThemed
              style={styles.emptyText}
              lightColor={Colors.neutral[600]}
              darkColor={Colors.dark.textSecondary}
            >
              No recent notifications
            </TextThemed>
          </ViewThemed>
        </PlatformBlurView>
      </ViewThemed>
    )
  }

  return (
    <ViewThemed style={styles.sectionContainer}>
      <PlatformBlurView
        style={styles.sectionBlur}
        intensity={100}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        experimentalBlurMethod={'dimezisBlurView'}
      >
        <ViewThemed
          style={[
            styles.section,
            {
              backgroundColor: isDarkMode
                ? blurBackgroundDark
                : blurBackgroundLight,
              borderColor: isDarkMode ? separatorDark : separatorLight,
            },
          ]}
        >
          <TextThemed style={styles.sectionTitle}>
            Recent Notifications
          </TextThemed>
          <FlatList
            data={notifications}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <ViewThemed
                style={styles.notificationItem}
                lightColor="transparent"
                darkColor="transparent"
              >
                <TextThemed style={styles.notificationIcon}>
                  {getNotificationIcon(item.type)}
                </TextThemed>
                <ViewThemed
                  style={styles.notificationContent}
                  lightColor="transparent"
                  darkColor="transparent"
                >
                  <TextThemed
                    style={[
                      styles.notificationMessage,
                      { color: getNotificationColor(item.type) },
                    ]}
                    numberOfLines={2}
                  >
                    {item.message}
                  </TextThemed>
                  <TextThemed
                    style={styles.notificationTime}
                    lightColor={Colors.neutral[500]}
                    darkColor={Colors.dark.textSecondary}
                  >
                    {formatRelativeTime(new Date(item.timestamp))}
                  </TextThemed>
                </ViewThemed>
              </ViewThemed>
            )}
            ItemSeparatorComponent={() => (
              <ViewThemed
                style={styles.separator}
                lightColor={Colors.neutral[200]}
                darkColor={Colors.dark.border}
              />
            )}
          />
        </ViewThemed>
      </PlatformBlurView>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.neutral.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    backgroundColor: Colors.transparent.clear,
  },
  sectionBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  section: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  notificationIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '500',
  },
  notificationTime: {
    fontSize: 12,
  },
  separator: {
    height: 1,
    marginVertical: 4,
  },
})
