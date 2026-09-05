import { FunctionsHttpError } from '@supabase/supabase-js'
import { getEdgeFunctionErrorMessage } from './edge-errors'

describe('getEdgeFunctionErrorMessage', () => {
  test('extracts an Edge Function payload error', async () => {
    const error = new FunctionsHttpError({
      json: jest.fn().mockResolvedValue({ error: 'Daily quota reached.' }),
    })

    await expect(
      getEdgeFunctionErrorMessage(error, 'Fallback message')
    ).resolves.toBe('Daily quota reached.')
  })

  test('falls back for unreadable or malformed HTTP errors', async () => {
    const unreadable = new FunctionsHttpError({
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    })
    const malformed = new FunctionsHttpError({
      json: jest.fn().mockResolvedValue({ error: 500 }),
    })

    await expect(
      getEdgeFunctionErrorMessage(unreadable, 'Fallback message')
    ).resolves.toBe('Fallback message')
    await expect(
      getEdgeFunctionErrorMessage(malformed, 'Fallback message')
    ).resolves.toBe('Edge Function returned a non-2xx status code')
  })

  test('uses regular Error messages and a fallback for unknown values', async () => {
    await expect(
      getEdgeFunctionErrorMessage(new Error('Network unavailable'), 'Fallback')
    ).resolves.toBe('Network unavailable')
    await expect(getEdgeFunctionErrorMessage(null, 'Fallback')).resolves.toBe(
      'Fallback'
    )
  })
})
