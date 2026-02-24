import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import { GlassHeader } from '@/components/glass/GlassHeader'
import { GlassHeaderDefaults } from '@/constants/GlassConstants'

interface WordHeaderProps {
  dutchLemma: string | null
  article: string | null
  onClose: () => void
}

export default function WordHeader({ dutchLemma, onClose }: WordHeaderProps) {
  return (
    <View
      style={[
        styles.header,
        {
          overflow: 'hidden',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          // Ensure the header box reserves height (GlassHeader is absolute)
          height: Math.max(GlassHeaderDefaults.height, 64),
          paddingHorizontal: 0,
          paddingVertical: 0,
        },
      ]}
    >
      <GlassHeader
        title={dutchLemma ?? ''}
        rightSlot={
          <TouchableOpacity
            testID="modal-close-button"
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color={Colors.neutral[600]} />
          </TouchableOpacity>
        }
        height={64}
      />
    </View>
  )
}
