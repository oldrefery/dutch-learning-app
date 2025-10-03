/**
 * Notification History Section
 * Shows recent toast notifications with timestamps
 */

import React from 'react'
import { StyleSheet, FlatList, useColorScheme } from 'react-native'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useHistoryStore } from '@/stores/useHistoryStore'
import { ToastType } from '@/constants/ToastConstants'
import { formatRelativeTime } from '@/utils/dateUtils'

export function NotificationHistorySection() {
  const colorScheme = useColorScheme() ?? 'light'
  const notifications = useHistoryStore(state => state.notifications)

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
      <ViewThemed
        style={styles.section}
        lightColor={Colors.background.secondary}
        darkColor={Colors.dark.backgroundSecondary}
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
    )
  }

  return (
    <ViewThemed
      style={styles.section}
      lightColor={Colors.background.secondary}
      darkColor={Colors.dark.backgroundSecondary}
    >
      <TextThemed style={styles.sectionTitle}>Recent Notifications</TextThemed>
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
  )
}

const styles = StyleSheet.create({
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
