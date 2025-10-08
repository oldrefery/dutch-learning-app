import React from 'react'
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native'
import { TextThemed } from '@/components/Themed'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import { BlurView } from 'expo-blur'
import { usePreferReducedTransparency } from '@/hooks/usePreferReducedTransparency'

interface WordHeaderProps {
  dutchLemma: string | null
  article: string | null
  onClose: () => void
}

export default function WordHeader({
  dutchLemma,
  article,
  onClose,
}: WordHeaderProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const isDarkMode = colorScheme === 'dark'
  const intensity = isDarkMode ? 25 : 30
  const reduceTransparency = usePreferReducedTransparency()
  return (
    <View
      style={[
        styles.header,
        {
          overflow: 'hidden',
          paddingTop: 12,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: isDarkMode
            ? 'rgba(255,255,255,0.28)'
            : 'rgba(60,60,67,0.29)',
        },
      ]}
    >
      {reduceTransparency ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDarkMode
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(255,255,255,0.5)',
            },
          ]}
        />
      ) : (
        <BlurView
          tint="default"
          intensity={intensity}
          style={StyleSheet.absoluteFill}
          experimentalBlurMethod={'dimezisBlurView'}
        />
      )}
      <View style={styles.headerContent}>
        <TextThemed style={styles.wordTitle}>{dutchLemma}</TextThemed>
        {article && (
          <TextThemed style={styles.articleText}>({article})</TextThemed>
        )}
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={24} color={Colors.neutral[600]} />
      </TouchableOpacity>
    </View>
  )
}
