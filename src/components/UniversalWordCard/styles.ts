import { StyleSheet } from 'react-native'
import { Colors } from '@/constants/Colors'

export const styles = StyleSheet.create({
  // Main container
  container: {
    minHeight: 100,
    width: '100%',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  compactContent: {
    padding: 12,
  },

  darkMode: {
    backgroundColor: Colors.error.darkModeChip,
    borderColor: Colors.error.darkMode,
  },

  // Header section
  headerSection: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  compactWordTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  pronunciationButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary.light,
    marginLeft: 8,
  },
  grammarInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  grammarTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    // Remove backgroundColor to let ViewThemed handle it
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  grammarTagText: {
    fontSize: 12,
    color: Colors.neutral[600],
    fontWeight: '500',
  },
  separableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  separableText: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  prefixText: {
    fontWeight: '600',
    color: Colors.primary.DEFAULT,
  },

  // Content sections
  section: {
    marginBottom: 16,
  },
  compactSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactSectionTitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  sectionIcon: {
    marginRight: 6,
  },

  // Translations
  translationGroup: {
    marginBottom: 8,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[600],
    marginBottom: 4,
  },
  translationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  translationBullet: {
    fontSize: 14,
    color: Colors.neutral[400],
    marginRight: 6,
    marginTop: 2,
  },
  translationText: {
    fontSize: 16,
    flex: 1,
  },
  compactTranslationText: {
    fontSize: 14,
  },

  // Examples
  exampleCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary.DEFAULT,
  },
  compactExampleCard: {
    padding: 8,
  },
  exampleDutch: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  compactExampleDutch: {
    fontSize: 14,
  },
  exampleTranslation: {
    fontSize: 14,
    marginBottom: 2,
  },
  compactExampleTranslation: {
    fontSize: 12,
  },

  // Image section
  imageContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  wordImage: {
    width: 200,
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  compactWordImage: {
    width: 150,
    height: 90,
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.primary.light,
    borderRadius: 16,
  },
  changeImageText: {
    fontSize: 14,
    color: Colors.primary.DEFAULT,
    marginLeft: 4,
    fontWeight: '500',
  },

  // Synonyms and Antonyms
  wordList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  synonymChip: {
    borderColor: Colors.success.light,
    backgroundColor: Colors.success.lightest,
  },
  antonymChip: {
    borderColor: Colors.error.light,
    backgroundColor: Colors.error.lightest,
  },
  wordChipText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  synonymChipText: {
    color: Colors.success.DEFAULT,
  },
  antonymChipText: {
    color: Colors.error.DEFAULT,
  },

  // Conjugation table - using theme-aware colors
  conjugationTable: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  conjugationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  conjugationLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7, // For secondary text appearance
  },
  conjugationValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Actions section
  actionsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  deleteButton: {
    backgroundColor: Colors.error.light,
    borderWidth: 1,
    borderColor: Colors.error.border,
  },
  saveButton: {
    backgroundColor: Colors.success.light,
    borderWidth: 1,
    borderColor: Colors.success.border,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  deleteButtonText: {},
  saveButtonText: {
    color: Colors.success.DEFAULT,
  },

  // Status and progress info
  statusInfo: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Duplicate check badge
  duplicateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  alreadyExistsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.success.lightest,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  checkingText: {
    color: Colors.neutral[500],
  },
  alreadyExistsText: {
    color: Colors.success.DEFAULT,
  },

  // Section header with the copy button
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Notes section - using theme-aware colors
  notesContainer: {
    borderRadius: 8,
    padding: 12,
    minHeight: 60,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  notesPlaceholder: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    opacity: 0.6, // For placeholder appearance
  },

  // Cache status elements
  cacheStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  cacheBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cacheBadgeFromCache: {
    backgroundColor: Colors.primary.light,
  },
  cacheBadgeFromGemini: {
    backgroundColor: Colors.success.light,
  },
  cacheBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.primary.DEFAULT,
  },
  forceRefreshButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: Colors.primary.light,
  },
  cacheTimestamp: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  cacheTimestampText: {
    fontSize: 10,
    color: Colors.neutral[500],
    fontStyle: 'italic',
  },
})
