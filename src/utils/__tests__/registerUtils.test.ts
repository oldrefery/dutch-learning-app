/**
 * Tests for registerUtils
 *
 * Pure utility functions for determining whether a word's register
 * should be displayed and generating labels for it.
 */

import { isDisplayableRegister, getRegisterLabel } from '../registerUtils'

describe('registerUtils', () => {
  describe('isDisplayableRegister', () => {
    it('should return true for formal register', () => {
      expect(isDisplayableRegister('formal')).toBe(true)
    })

    it('should return true for informal register', () => {
      expect(isDisplayableRegister('informal')).toBe(true)
    })

    it('should return false for neutral register', () => {
      expect(isDisplayableRegister('neutral')).toBe(false)
    })

    it('should return false for null', () => {
      expect(isDisplayableRegister(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isDisplayableRegister(undefined)).toBe(false)
    })
  })

  describe('getRegisterLabel', () => {
    it('should return "Formal" for formal register', () => {
      expect(getRegisterLabel('formal')).toBe('Formal')
    })

    it('should return "Informal" for informal register', () => {
      expect(getRegisterLabel('informal')).toBe('Informal')
    })
  })
})
