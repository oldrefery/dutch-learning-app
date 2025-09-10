import { StyleSheet } from 'react-native'

export const analysisResultStyles = StyleSheet.create({
  resultContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  resultCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  checkingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  checkingText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  alreadyExistsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  alreadyExistsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  resultRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  resultSection: {
    marginBottom: 16,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    width: 80,
    marginRight: 12,
  },
  resultValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  wordWithPronunciation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  pronunciationButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  translationText: {
    fontSize: 14,
    color: '#1f2937',
    marginLeft: 16,
    marginBottom: 4,
  },
  exampleCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginLeft: 16,
  },
  exampleDutch: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  exampleTranslation: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  associationImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginLeft: 16,
    marginTop: 8,
  },
  prefixText: {
    fontWeight: 'bold',
    color: '#dc2626', // Red color to highlight the separable prefix
  },
  imageContainer: {
    marginLeft: 16,
    marginTop: 8,
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  changeImageText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
})
