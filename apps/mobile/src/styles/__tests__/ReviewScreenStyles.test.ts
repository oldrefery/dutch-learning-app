import { reviewScreenStyles } from '../ReviewScreenStyles'

describe('reviewScreenStyles', () => {
  it('keeps the completion action bounded in the vertical layout', () => {
    expect(reviewScreenStyles.completionPrimaryButton).toEqual(
      expect.objectContaining({
        width: '100%',
        maxWidth: 320,
        minHeight: 48,
      })
    )
    expect(reviewScreenStyles.completionPrimaryButton).not.toHaveProperty(
      'flex'
    )
  })
})
