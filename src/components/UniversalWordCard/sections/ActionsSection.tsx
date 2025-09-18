import React from 'react'
import { TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import type { WordCardData, WordCardActionConfig } from '../types'
import { isWordFromDB } from '../types'

interface ActionsSectionProps {
  word: WordCardData
  actions: WordCardActionConfig
}

export function ActionsSection({ word, actions }: ActionsSectionProps) {
  const hasAnyActions =
    actions.showDeleteButton ||
    actions.showSaveButton ||
    actions.showProgressInfo ||
    actions.showStatusInfo ||
    actions.showDuplicateCheck

  if (!hasAnyActions) return null

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <ViewThemed style={styles.actionsSection}>
      {/* Duplicate check info */}
      {actions.showDuplicateCheck && (
        <ViewThemed style={styles.duplicateContainer}>
          {actions.isDuplicateChecking && (
            <ViewThemed style={styles.checkingBadge}>
              <Ionicons
                name="hourglass"
                size={16}
                color={Colors.neutral[500]}
              />
              <TextThemed style={[styles.badgeText, styles.checkingText]}>
                Checking...
              </TextThemed>
            </ViewThemed>
          )}
          {actions.isAlreadyInCollection && !actions.isDuplicateChecking && (
            <ViewThemed style={styles.alreadyExistsBadge}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={Colors.success.DEFAULT}
              />
              <TextThemed style={[styles.badgeText, styles.alreadyExistsText]}>
                Already in collection
              </TextThemed>
            </ViewThemed>
          )}
        </ViewThemed>
      )}

      {/* Progress and Status info */}
      {(actions.showProgressInfo || actions.showStatusInfo) &&
        isWordFromDB(word) && (
          <ViewThemed style={styles.statusInfo}>
            {actions.showProgressInfo && (
              <>
                <ViewThemed style={styles.statusRow}>
                  <TextThemed style={styles.statusLabel}>Reviews:</TextThemed>
                  <TextThemed style={styles.statusValue}>
                    {word.repetition_count || 0}
                  </TextThemed>
                </ViewThemed>

                {word.easiness_factor && (
                  <ViewThemed style={styles.statusRow}>
                    <TextThemed style={styles.statusLabel}>
                      Ease Factor:
                    </TextThemed>
                    <TextThemed style={styles.statusValue}>
                      {word.easiness_factor.toFixed(1)}
                    </TextThemed>
                  </ViewThemed>
                )}
              </>
            )}

            {actions.showStatusInfo && (
              <ViewThemed style={styles.statusRow}>
                <TextThemed style={styles.statusLabel}>Next Review:</TextThemed>
                <TextThemed style={styles.statusValue}>
                  {formatDate(word.next_review_date)}
                </TextThemed>
              </ViewThemed>
            )}
          </ViewThemed>
        )}

      {/* Action buttons */}
      {actions.showSaveButton && actions.onSave && (
        <TouchableOpacity
          style={[styles.actionButton, styles.saveButton]}
          onPress={actions.onSave}
        >
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={Colors.success.DEFAULT}
          />
          <TextThemed style={[styles.actionButtonText, styles.saveButtonText]}>
            Save to Collection
          </TextThemed>
        </TouchableOpacity>
      )}

      {actions.showDeleteButton && actions.onDelete && (
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => {
            Alert.alert(
              'Delete Word',
              `Are you sure you want to delete "${word.dutch_lemma}"?`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: actions.onDelete,
                },
              ]
            )
          }}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={Colors.error.DEFAULT}
          />
          <TextThemed
            style={[styles.actionButtonText, styles.deleteButtonText]}
          >
            Delete Word
          </TextThemed>
        </TouchableOpacity>
      )}
    </ViewThemed>
  )
}
