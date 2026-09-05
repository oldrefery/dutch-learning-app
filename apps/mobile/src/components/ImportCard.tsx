import React from 'react'
import { TouchableOpacity, useColorScheme, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface ImportCardProps {
  onPress: () => void
}

export function ImportCard({ onPress }: ImportCardProps) {
  const colorScheme = useColorScheme() ?? 'light'

  return (
    <TouchableOpacity style={styles.importCard} onPress={onPress}>
      <ViewThemed
        style={[
          styles.importCardContent,
          {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.backgroundSecondary
                : Colors.primary.light,
            borderColor:
              colorScheme === 'dark'
                ? Colors.dark.border
                : Colors.primary.DEFAULT,
          },
        ]}
      >
        <ViewThemed
          style={[
            styles.importIcon,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.dark.backgroundTertiary
                  : 'white',
            },
          ]}
        >
          <Ionicons
            name="download"
            size={24}
            color={
              colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
            }
          />
        </ViewThemed>
        <ViewThemed style={styles.importTextContainer}>
          <TextThemed
            style={[
              styles.importTitle,
              {
                color:
                  colorScheme === 'dark'
                    ? Colors.dark.tint
                    : Colors.primary.DEFAULT,
              },
            ]}
          >
            Import to Your Library
          </TextThemed>
          <TextThemed
            style={styles.importSubtitle}
            lightColor={Colors.neutral[600]}
            darkColor={Colors.dark.textSecondary}
          >
            Add these words to your collections
          </TextThemed>
        </ViewThemed>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={
            colorScheme === 'dark'
              ? Colors.dark.textTertiary
              : Colors.neutral[400]
          }
        />
      </ViewThemed>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  importCard: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  importCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  importIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    marginRight: 16,
  },
  importTextContainer: {
    flex: 1,
  },
  importTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  importSubtitle: {
    fontSize: 14,
  },
})
