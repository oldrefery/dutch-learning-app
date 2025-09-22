# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Build 6] - 2025-09-22

### Added

- **Analysis Notes Display**: Added read-only analysis notes field visible in all word display modes
  - Shows analysis notes in word analysis, modal, and review screens
  - Apple HIG compliant empty state placeholder when no notes available
  - Database migration adds `analysis_notes` column to words table
  - Full type safety with TypeScript interfaces

### Changed

- **Toast System Simplification**: Streamlined notification system following UX best practices
  - Reduced from 4 toast types to 3 (SUCCESS, ERROR, INFO)
  - Replaced 10+ specialized methods with single `ToastService.show()` API
  - Implemented Apple HIG compliant colors for light and dark themes
  - Optimized timing based on UX research (3s success, 4s error, 2.5s info)
  - Migrated 40+ toast calls across 13 files to new simplified API
  - Added comprehensive documentation to prevent future complexity

### Technical

- Enhanced UniversalWordCard component with NotesSection
- Updated database schema with proper column documentation
- Improved type definitions for analysis data flow
- Consolidated toast configuration for better maintainability

---

## [Build 5] - Current Production

- Enhanced word analysis with synonyms, antonyms, and grammar information
- Improved image selection and display functionality
- Comprehensive gesture system implementation
- Modern UI/UX improvements

---

_Previous builds documented in PROJECT_PLAN.md_
