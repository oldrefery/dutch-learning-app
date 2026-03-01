/**
 * UpdateStatusBadge
 * Displays EAS Update status with check/download functionality
 */

import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useUpdateStatus } from '@/hooks/useUpdateStatus'

export function UpdateStatusBadge() {
  const { status, checkForUpdate, downloadAndApplyUpdate } = useUpdateStatus()

  if (!status.isEnabled) {
    return null
  }

  const handlePress = () => {
    if (status.updateAvailable) {
      void downloadAndApplyUpdate()
    } else {
      void checkForUpdate()
    }
  }

  const getBadgeColor = () => {
    if (status.updateAvailable) return Colors.success.DEFAULT
    if (status.error) return Colors.error.DEFAULT
    return Colors.neutral[400]
  }

  const getStatusText = () => {
    if (status.isChecking) return 'Checking...'
    if (status.isDownloading) return 'Downloading...'
    if (status.updateAvailable) return 'Update available - tap to install'
    if (status.error) return 'Check failed'
    const channelSuffix = status.channel ? ` (${status.channel})` : ''
    return `Up to date${channelSuffix}`
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      disabled={status.isChecking || status.isDownloading}
    >
      <ViewThemed
        style={[styles.badge, { backgroundColor: getBadgeColor() }]}
      />
      <TextThemed
        style={styles.text}
        lightColor={Colors.neutral[500]}
        darkColor={Colors.dark.textSecondary}
      >
        {getStatusText()}
      </TextThemed>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
  },
})
