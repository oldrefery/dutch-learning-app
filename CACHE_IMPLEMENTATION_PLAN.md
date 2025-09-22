# Smart Word Analysis Cache - Implementation Plan

## Objective

Implement word analysis caching shared between users to:

- Speed up analysis (80-90% requests from cache)
- Reduce Gemini API costs
- Improve user experience

## Solution Architecture

### Database

- **Table**: `word_analysis_cache` (shared across all users)
- **Key**: `dutch_lemma` (already normalized via `trim().toLowerCase()`)
- **RLS**: authenticated users can only read
- **TTL**: 30 days default with configurable options

### Caching Logic

1. **Cache hit**: return from cache + update usage stats
2. **Cache miss**: call Gemini + save to cache
3. **Force refresh**: bypass cache on user request

## Implementation Plan

### 1. Database Layer

- [ ] **Migration for `word_analysis_cache` table**
  - All word analysis fields (translations, examples, etc.)
  - `dutch_lemma` as key (already normalized)
  - Cache management (cache_version, usage_count, TTL)
  - RLS policies (SELECT only for authenticated)

- [ ] **Helper functions**
  - `is_cache_entry_valid()` - check TTL
  - `increment_cache_usage()` - usage statistics
  - `get_valid_cache_entry()` - get valid entry

### 2. Edge Function (Server Layer)

- [ ] **Update `gemini-handler/index.ts`**
  - Check cache before calling Gemini
  - Support `forceRefresh` parameter
  - Save results to cache
  - Update usage statistics

- [ ] **Create cache utilities**
  - `cacheUtils.ts` - database cache operations
  - Check and save functions

### 3. Client Layer (Frontend)

- [ ] **Update `wordService.analyzeWord()`**
  - Add `options?: {forceRefresh?: boolean}`
  - Pass parameter to Edge Function

- [ ] **Update `useWordAnalysis` hook**
  - Support `forceRefresh` flag
  - New types for cache fields

- [ ] **UI for force refresh**
  - "Refresh analysis" button
  - Data source indication (cache/Gemini)

### 4. Types and Interfaces

- [ ] **Update database types**
  - `WordAnalysisCache` interface
  - Cache metadata support

- [ ] **API parameters**
  - Types for `forceRefresh` option
  - Metadata in responses

### 5. Documentation

- [ ] **Update README**
  - Caching system description
  - Force refresh examples

- [ ] **Logging**
  - Cache hit/miss metrics
  - Performance statistics

### 6. Testing (at the end)

- [ ] **Unit tests**
  - Caching logic
  - Force refresh functionality

- [ ] **Integration tests**
  - Full caching flow
  - Usage statistics

## Technical Details

### Normalization

- Use existing logic: `dutch_lemma = word.trim().toLowerCase()`
- Remove `dutch_lemma_normalized` - not needed

### Cache TTL Strategy

- 30 days base TTL with jitter
- Versioning for prompt updates
- Force refresh bypasses entire cache

### Security

- RLS: authenticated read, only Edge Functions write
- Service key only on server
- No personal data in cache

### Performance

- Indexes on `dutch_lemma`, `usage_count`, `created_at`
- Statistics for popular word optimization
- Direct SELECT queries from clients

## Execution Order

1. Database (migration + functions)
2. Edge Function updates
3. Client API changes
4. UI components
5. Types and documentation
6. Testing

## Expected Results

- 80-90% requests from cache
- Response time < 100ms for cached words
- Reduced Gemini API costs
- Improved UX for popular words analysis
