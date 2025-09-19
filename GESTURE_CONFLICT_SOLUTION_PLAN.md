# План решения конфликтов gesture между кнопками и переворачиванием карточки

## Проблема

В review screen при нажатии на кнопки (озвучка, копирование, удаление) на обратной стороне карточки, кнопки срабатывают корректно, но карточка также переворачивается, что нежелательно.

## Текущее состояние

- Используется `blocksExternalGesture()` в кнопках
- Кнопки срабатывают правильно
- Родительский gesture карточки все равно активируется после кнопок
- Логи показывают последовательность: кнопка → родительский gesture → переворот карточки

## Исследованные решения

### 1. blocksExternalGesture() - НЕ РАБОТАЕТ

**Статус**: Попробовано, не работает
**Код локации**:

- `PronunciationButton.tsx:27`
- `CopyButton.tsx:60`
- `CardBack.tsx:49`
- `ImageSection.tsx:21`

**Проблема**: Gesture карточки все равно активируется после button gestures

### 2. requireExternalGestureToFail - ЧАСТИЧНО ПРОТЕСТИРОВАНО

**Статус**: Попробовано с shared gestures, затем откачено
**Описание**: Заставить gesture карточки ждать failure всех button gestures
**Плюсы**: Правильная логика - карточка ждет
**Минусы**: Требует рефакторинга всех компонентов для shared gestures

**Код для реализации**:

```typescript
// В useReviewScreen.ts
const tapGesture = Gesture.Tap().requireExternalGestureToFail(
  pronunciationGesture(),
  copyGesture(),
  deleteGesture(),
  changeImageGesture()
)
```

### 3. simultaneousWithExternalGesture(false) - НЕ ПРОТЕСТИРОВАНО

**Статус**: Планируется
**Описание**: Явно запретить одновременные gestures
**Локация для тестирования**: gesture карточки в `useReviewScreen.ts`

### 4. Gesture hierarchy проблема - НЕ ИССЛЕДОВАНО

**Статус**: Требует исследования
**Проблема**: Возможно gesture карточки и gesture кнопок находятся в разных GestureDetector
**Решение**: Объединить все gestures в один GestureDetector

### 5. Event propagation подход - НЕ ПРОТЕСТИРОВАНО

**Статус**: Альтернативный подход
**Описание**: Использовать обычные TouchableOpacity с event.stopPropagation()
**Риски**: Может не работать с gesture system

## Рекомендуемый план действий

### Этап 1: Быстрые тесты

1. **simultaneousWithExternalGesture(false)** на gesture карточки
2. **Gesture.Race()** вместо Gesture.Simultaneous() для карточки
3. **Изменить порядок gestures** в combined gesture

### Этап 2: Архитектурные изменения

1. **requireExternalGestureToFail с shared gestures** (уже протестировано, можно вернуть)
2. **Единый GestureDetector** для всей карточки с composition
3. **Native gesture подход** для кнопок

### Этап 3: Альтернативные подходы

1. **Condition-based gesture** - включать/выключать gesture карточки в зависимости от контекста
2. **State-based решение** - блокировать flip через состояние при нажатии кнопок
3. **Timeout-based решение** - добавить задержку для gesture карточки

## Код локации для изменений

### Основные файлы

- `src/hooks/useReviewScreen.ts:252` - gesture карточки с requireExternalGestureToFail
- `src/app/(tabs)/review.tsx:200-203` - combined gesture карточки
- `src/components/ReviewCard/PronunciationButton.tsx:27` - blocksExternalGesture
- `src/components/CopyButton.tsx:60` - blocksExternalGesture

### Файлы с кнопками на обратной стороне

- `src/components/ReviewCard/CardBack.tsx` - delete button
- `src/components/ReviewCard/ImageSection.tsx` - change image button
- `src/components/UniversalWordCard/sections/HeaderSection.tsx` - pronunciation + copy
- `src/components/UniversalWordCard/sections/ActionsSection.tsx` - delete button

## Тестирование

Для каждого решения проверить:

1. Кнопки работают (озвучка, копирование, удаление)
2. Карточка НЕ переворачивается при нажатии кнопок
3. Карточка переворачивается при тапе на свободную область
4. Swipe navigation работает
5. Double tap для word detail работает

## Отладочная информация

- Sentry 7.x настроен для crash reporting
- Подробные логи в console для gesture lifecycle
- React Native Gesture Handler 2.x с React Native Worklets
- Reanimated 4.x с scheduleOnRN вместо runOnJS

## Последнее рабочее состояние

Commit с работающим подходом `requireExternalGestureToFail` был откачен, но код сохранен для возможного возврата.
