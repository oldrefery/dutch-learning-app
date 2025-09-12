import { StyleSheet } from 'react-native'
import { REVIEW_SCREEN_CONSTANTS } from '@/constants/ReviewScreenConstants'

export const reviewScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: REVIEW_SCREEN_CONSTANTS.COLORS.BACKGROUND,
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
    color: REVIEW_SCREEN_CONSTANTS.COLORS.TEXT_SECONDARY,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.XL,
  },

  emptyText: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.LARGE,
    color: REVIEW_SCREEN_CONSTANTS.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },

  emptySubtext: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    color: REVIEW_SCREEN_CONSTANTS.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },

  cardContainer: {
    flex: 1,
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },

  flashcard: {
    flex: 1,
    backgroundColor: REVIEW_SCREEN_CONSTANTS.COLORS.CARD_BACKGROUND,
    borderRadius: 16,
    shadowColor: '#000',
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
    backgroundColor: REVIEW_SCREEN_CONSTANTS.COLORS.ERROR,
  },

  hardButton: {
    backgroundColor: REVIEW_SCREEN_CONSTANTS.COLORS.WARNING,
  },

  goodButton: {
    backgroundColor: REVIEW_SCREEN_CONSTANTS.COLORS.SUCCESS,
  },

  easyButton: {
    backgroundColor: REVIEW_SCREEN_CONSTANTS.COLORS.PRIMARY,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    fontWeight: '600',
  },

  progressContainer: {
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    paddingVertical: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },

  progressText: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    color: REVIEW_SCREEN_CONSTANTS.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
})
