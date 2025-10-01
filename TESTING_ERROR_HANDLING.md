# Testing Error Handling Implementation

## Manual Testing Scenarios

### 1. Network Error Testing (FunctionsFetchError)

#### Test Case 1: Airplane Mode

**Steps:**

1. Запустить приложение на симуляторе/устройстве
2. Открыть экран "Add Word"
3. Включить Airplane Mode на устройстве
4. Ввести слово и нажать "Analyze"

**Expected Result:**

- Показывается toast: "🌐 Connection error. Please check your internet and try again."
- В Sentry появляются breadcrumbs с 3 попытками retry
- Длительность: ~7 секунд (1s + 2s + 4s)

**Sentry Breadcrumbs Expected:**

```
1. word.analysis: Starting word analysis for: [word]
2. retry: Retry attempt 1/3
3. supabase.retry: Supabase function gemini-handler will retry
4. retry: Waiting 1000ms before retry
5. retry: Retry attempt 2/3
6. ... (similar for attempt 3)
7. word.analysis: Word analysis failed: NETWORK
```

#### Test Case 2: Slow Network

**Steps:**

1. В iOS Simulator: Settings → Developer → Network Link Conditioner → Enable → Very Bad Network
2. В Android Emulator: Settings → Network & internet → Mobile network → Preferred network type → 2G
3. Попробовать проанализировать слово

**Expected Result:**

- Retry происходит автоматически
- Если успешно после retry - показывается успешное сообщение
- Если все 3 попытки неудачны - network error toast

### 2. Server Error Testing (500 errors)

#### Test Case 3: Simulate Server Error

**Steps:**

1. Временно модифицировать Edge Function для возврата 500 error:

```typescript
// В supabase/functions/gemini-handler/index.ts
// Добавить в начало функции:
if (word === 'test500') {
  throw new Error('Simulated server error')
}
```

2. Deploy Edge Function: `npm run deploy:gemini`
3. Попробовать проанализировать слово "test500"

**Expected Result:**

- Toast: "⚠️ Server error. Please try again later."
- В Sentry: ErrorCategory.SERVER, severity: ERROR
- **НЕ** должно быть retry (permanent server error)

### 3. Client Error Testing (400 errors)

#### Test Case 4: Invalid Input

**Steps:**

1. Попробовать проанализировать пустую строку
2. Попробовать проанализировать спецсимволы: "!@#$%"

**Expected Result:**

- Toast: "ℹ️ Invalid request. Please check your input." или
- Toast: "Please enter a Dutch word" (для пустой строки)

### 4. Success with Cache Testing

#### Test Case 5: Cache Hit

**Steps:**

1. Проанализировать слово первый раз (например, "huis")
2. Очистить результат
3. Проанализировать то же слово снова

**Expected Result:**

- Первый раз: Toast "Word analyzed with fresh AI"
- Второй раз: Toast "Word loaded from cache (used X times)"
- Нет retry (успешный ответ сразу)

## Testing in Development

### Option 1: Using Expo Dev Client

```bash
# 1. Start development server
npm start

# 2. На устройстве/симуляторе:
# - Включить Airplane Mode
# - Попробовать добавить слово
# - Наблюдать поведение retry
```

### Option 2: Network Debugging

#### iOS Simulator:

1. Settings → Developer → Network Link Conditioner
2. Выбрать профиль сети:
   - "Very Bad Network" - для тестирования retry
   - "100% Loss" - для тестирования network error

#### Android Emulator:

1. Settings → More → Cellular Networks → Preferred network type
2. Или через командную строку:

```bash
adb shell
svc wifi disable
svc data disable
```

### Option 3: Chrome DevTools

```bash
# 1. Start dev server
npm start

# 2. Press 'j' для открытия debugger

# 3. В Chrome DevTools:
# - Network tab → Throttling → Offline
# - Попробовать добавить слово
```

## Checking Sentry Integration

### View Breadcrumbs in Sentry Dashboard:

1. Открыть [Sentry Dashboard](https://sentry.io/organizations/oldrefery/issues/)
2. Найти issue с FunctionsFetchError
3. Проверить наличие breadcrumbs:
   - ✅ `word.analysis`: Starting/Completed/Failed
   - ✅ `retry`: Retry attempts with delays
   - ✅ `supabase.retry`: Retry decisions

### Expected Sentry Event Structure:

```json
{
  "tags": {
    "operation": "analyzeWord",
    "errorCategory": "NETWORK",
    "severity": "WARNING"
  },
  "extra": {
    "word": "example",
    "forceRefresh": false,
    "isRetryable": true,
    "userMessage": "Connection error. Please check your internet and try again."
  },
  "level": "warning",
  "breadcrumbs": [
    {
      "category": "word.analysis",
      "message": "Starting word analysis for: example"
    },
    {
      "category": "retry",
      "message": "Retry attempt 1/3"
    }
    // ... etc
  ]
}
```

## Production Testing

### Using TestFlight (iOS) or Internal Testing (Android):

1. Build production version:

```bash
./scripts/build-and-submit.sh --build-only
```

2. Install на реальное устройство

3. Тестирование в реальных условиях:
   - В метро (плохая связь)
   - При переключении с WiFi на мобильную сеть
   - В местах с нестабильным интернетом

## Monitoring Improvements

### Before the fix:

- ❌ FunctionsFetchError → immediate failure
- ❌ No retry attempts
- ❌ Generic error message
- ❌ No context in Sentry

### After the fix:

- ✅ FunctionsFetchError → 3 retry attempts with exponential backoff
- ✅ User-friendly categorized error messages
- ✅ Detailed Sentry breadcrumbs
- ✅ Clear error categorization (Network/Server/Client)

## Performance Testing

### Measure retry timing:

```typescript
// Add to useWordAnalysis.ts for testing:
const startTime = Date.now()
try {
  await wordService.analyzeWord(word)
} catch (error) {
  const duration = Date.now() - startTime
  console.log(`Failed after ${duration}ms`)
  // Expected: ~7000ms for 3 retries (1s + 2s + 4s)
}
```

## Success Criteria

- ✅ Network errors trigger automatic retry (3 attempts)
- ✅ Exponential backoff delays are correct (1s, 2s, 4s)
- ✅ User sees appropriate error messages with emoji
- ✅ Sentry receives categorized errors with breadcrumbs
- ✅ Server 5xx errors don't retry unnecessarily
- ✅ Client 4xx errors don't retry
- ✅ Success cases work as before (no regression)
- ✅ Cache functionality still works properly

## Rollback Plan

If issues are found:

```bash
git checkout main
git branch -D feature/fix-edge-function-network-errors
```

Or revert specific changes while keeping the branch.
