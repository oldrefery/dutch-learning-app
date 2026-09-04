import React from 'react'
import { Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SymbolView } from 'expo-symbols'
import { TextThemed, ViewThemed, useThemeColor } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'

interface CollectionActionSheetProps {
  visible: boolean
  onClose: () => void
  collectionName: string
  isShared: boolean
  onShare?: () => void
  onCopyCode?: () => void
  onStopSharing?: () => void
}

function StopSharingIcon({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const errorColor =
    colorScheme === 'dark' ? Colors.error.darkMode : Colors.error.DEFAULT

  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name="person.2.slash"
        size={20}
        type="hierarchical"
        tintColor={errorColor}
        style={styles.actionIcon}
        fallback={
          <Ionicons name="person-remove-outline" size={24} color={errorColor} />
        }
      />
    )
  }

  return <Ionicons name="person-remove-outline" size={24} color={errorColor} />
}

function CopyIcon({
  tintColor,
}: {
  colorScheme: 'light' | 'dark'
  tintColor: string
}) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name="doc.on.clipboard"
        size={20}
        type="hierarchical"
        tintColor={tintColor}
        style={styles.actionIcon}
        fallback={<Ionicons name="copy-outline" size={24} color={tintColor} />}
      />
    )
  }

  return <Ionicons name="copy-outline" size={24} color={tintColor} />
}

export default function CollectionActionSheet({
  visible,
  onClose,
  collectionName,
  isShared,
  onShare,
  onCopyCode,
  onStopSharing,
}: CollectionActionSheetProps) {
  const colorScheme = useNormalizedColorScheme()
  const textColor = useThemeColor({}, 'text')
  const textSecondaryColor = useThemeColor({}, 'textSecondary')
  const borderColor = useThemeColor({}, 'border')
  const tintColor = useThemeColor({}, 'tint')

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  const errorColor =
    colorScheme === 'dark' ? Colors.error.darkMode : Colors.error.DEFAULT

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <ViewThemed
          style={[
            styles.container,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.dark.backgroundElevated
                  : Colors.background.primary,
              borderColor:
                colorScheme === 'dark' ? Colors.neutral[600] : 'transparent',
              borderWidth: colorScheme === 'dark' ? 1 : 0,
            },
          ]}
        >
          <ViewThemed
            style={[styles.header, { borderBottomColor: borderColor }]}
          >
            <TextThemed style={styles.title}>{collectionName}</TextThemed>
          </ViewThemed>

          <ViewThemed style={styles.actionsContainer}>
            {isShared ? (
              <>
                {onCopyCode && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleAction(onCopyCode)}
                  >
                    <ViewThemed style={styles.actionContent}>
                      <CopyIcon
                        colorScheme={colorScheme}
                        tintColor={tintColor}
                      />
                      <TextThemed
                        style={[styles.actionText, { color: textColor }]}
                      >
                        Copy Code
                      </TextThemed>
                    </ViewThemed>
                  </TouchableOpacity>
                )}
                {onStopSharing && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleAction(onStopSharing)}
                  >
                    <ViewThemed style={styles.actionContent}>
                      <StopSharingIcon colorScheme={colorScheme} />
                      <TextThemed
                        style={[styles.actionText, { color: errorColor }]}
                      >
                        Stop Sharing
                      </TextThemed>
                    </ViewThemed>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              onShare && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleAction(onShare)}
                >
                  <ViewThemed style={styles.actionContent}>
                    <Ionicons
                      name="share-outline"
                      size={24}
                      color={tintColor}
                    />
                    <TextThemed
                      style={[styles.actionText, { color: textColor }]}
                    >
                      Share Collection
                    </TextThemed>
                  </ViewThemed>
                </TouchableOpacity>
              )
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={onClose}
            >
              <ViewThemed style={[styles.actionContent, styles.cancelContent]}>
                <TextThemed
                  style={[styles.actionText, { color: textSecondaryColor }]}
                >
                  Cancel
                </TextThemed>
              </ViewThemed>
            </TouchableOpacity>
          </ViewThemed>
        </ViewThemed>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.transparent.modalOverlay,
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '40%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  actionsContainer: {
    padding: 16,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  actionIcon: {
    width: 24,
    height: 24,
  },
  cancelButton: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    paddingTop: 24,
  },
  cancelContent: {
    justifyContent: 'center',
  },
})
