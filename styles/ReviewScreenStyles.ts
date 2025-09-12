import { StyleSheet } from 'react-native'
import { REVIEW_SCREEN_CONSTANTS } from '@/constants/ReviewScreenConstants'
import { Colors } from '@/constants/Colors'

export const reviewScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[100],
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.XL,
  },

  loadingText: {
    marginTop: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    color: Colors.neutral[500],
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.XL,
  },

  emptyText: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.LARGE,
    color: Colors.neutral[500],
    textAlign: 'center',
    marginBottom: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },

  emptySubtext: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    color: Colors.neutral[500],
    textAlign: 'center',
  },

  cardContainer: {
    flex: 1,
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },

  flashcard: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    shadowColor: Colors.legacy.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: REVIEW_SCREEN_CONSTANTS.CARD_MIN_HEIGHT,
  },

  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    paddingVertical: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    gap: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },

  srsButton: {
    flex: 1,
    paddingVertical: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
    borderRadius: 12,
    alignItems: 'center',
  },

  againButton: {
    backgroundColor: Colors.error.DEFAULT,
  },

  hardButton: {
    backgroundColor: Colors.warning.DEFAULT,
  },

  goodButton: {
    backgroundColor: Colors.success.DEFAULT,
  },

  easyButton: {
    backgroundColor: Colors.primary.DEFAULT,
  },

  buttonText: {
    color: Colors.legacy.white,
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    fontWeight: '600',
  },

  progressContainer: {
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    paddingVertical: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },

  progressText: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    color: Colors.neutral[500],
    textAlign: 'center',
  },
})
