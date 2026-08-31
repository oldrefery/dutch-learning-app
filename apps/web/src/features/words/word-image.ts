import { canRenderWordImage } from './word-detail'

export interface WordImageValidationResult {
  error: string | null
  value: string | null
}

export const validateWordImageUrl = (
  value: FormDataEntryValue | null
): WordImageValidationResult => {
  if (typeof value !== 'string' || !canRenderWordImage(value)) {
    return {
      value: null,
      error: 'Choose an image returned by the image search.',
    }
  }

  return { value, error: null }
}
