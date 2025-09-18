# UniversalWordCard Component

Универсальный компонент для отображения информации о словах в приложении Dutch Learning App. Поддерживает все новые поля из обновленного Gemini промпта и предоставляет гибкие настройки для разных контекстов использования.

## Основные возможности

- ✅ **Все поля**: синонимы, антонимы, спряжения, множественное число, предлоги
- ✅ **Воспроизведение произношения** везде
- ✅ **Смена картинок** везде
- ✅ **Конфигурируемые секции** - показывать/скрывать любые части
- ✅ **Готовые пресеты** для разных режимов
- ✅ **Действия и кнопки** - удаление, сохранение, статистика

## Быстрый старт

```tsx
import {
  UniversalWordCard,
  WordCardPresets,
} from '@/components/UniversalWordCard'

// Простое использование с пресетом
;<UniversalWordCard
  word={wordData}
  config={WordCardPresets.modal.config}
  actions={WordCardPresets.modal.actions}
/>
```

## Пресеты для разных случаев

### 1. Modal (WordDetailModal)

Полная информация о слове в модальном окне:

```tsx
<UniversalWordCard
  word={word}
  config={WordCardPresets.modal.config}
  actions={WordCardPresets.modal.actions}
  isPlayingAudio={isPlaying}
  onPlayPronunciation={handlePlayAudio}
/>
```

### 2. Analysis (AddWordScreen)

Анализ нового слова с возможностью сохранения:

```tsx
<UniversalWordCard
  word={analysisResult}
  config={WordCardPresets.analysis.config}
  actions={{
    ...WordCardPresets.analysis.actions,
    isDuplicateChecking: isChecking,
    isAlreadyInCollection: isDuplicate,
    onSave: handleSaveWord,
  }}
  onChangeImage={handleImageChange}
/>
```

### 3. Review (ReviewCard back)

Компактный вид для ревью:

```tsx
<UniversalWordCard
  word={currentWord}
  config={WordCardPresets.review.config}
  actions={{
    ...WordCardPresets.review.actions,
    onDelete: handleDeleteWord,
  }}
/>
```

### 4. Compact (списки)

Минимальная информация:

```tsx
<UniversalWordCard word={word} config={WordCardPresets.compact.config} />
```

## Кастомная конфигурация

```tsx
<UniversalWordCard
  word={word}
  config={{
    // Секции контента
    showHeader: true,
    showTranslations: true,
    showExamples: true,
    showImage: true,
    showSynonyms: true, // 🆕 Новое!
    showAntonyms: true, // 🆕 Новое!
    showGrammarInfo: true,
    showConjugation: true, // 🆕 Новое!

    // Интерактивность
    enablePronunciation: true,
    enableImageChange: true,

    // Внешний вид
    scrollable: true,
    compact: false,
  }}
  actions={{
    // Кнопки действий
    showDeleteButton: true,
    showSaveButton: false,

    // Информация о прогрессе
    showProgressInfo: true,
    showStatusInfo: true,

    // Проверка дубликатов
    showDuplicateCheck: false,
    isDuplicateChecking: false,
    isAlreadyInCollection: false,

    // Обработчики
    onDelete: () => handleDelete(),
    onSave: () => handleSave(),
  }}
/>
```

## Новые поля в действии

### Синонимы и антонимы

```tsx
// Отображаются как чипы с разными цветами
word.synonyms = ['plezier hebben', 'leuk vinden']
word.antonyms = ['haten', 'verachten']
```

### Спряжения глаголов

```tsx
word.conjugation = {
  present: 'eet', // ik eet
  simple_past: 'at', // ik at
  past_participle: 'gegeten', // ik heb gegeten
}
```

### Множественное число

```tsx
word.plural = 'uitgeverijen' // для существительных
```

### Фиксированные предлоги

```tsx
word.preposition = 'van' // genieten van
```

## Замена существующих компонентов

### Вместо WordDetailModal:

```tsx
// Было
<WordDetailModal visible={visible} word={word} onClose={onClose} />

// Стало
<Modal visible={visible} onRequestClose={onClose}>
  <UniversalWordCard
    word={word}
    config={WordCardPresets.modal.config}
    actions={WordCardPresets.modal.actions}
  />
</Modal>
```

### Вместо AnalysisResultCard:

```tsx
// Было
<AnalysisResultCard
  analysisResult={result}
  isPlayingAudio={isPlaying}
  onPlayPronunciation={handlePlay}
  onShowImageSelector={handleImage}
  isAlreadyInCollection={isDupe}
/>

// Стало
<UniversalWordCard
  word={result}
  config={WordCardPresets.analysis.config}
  actions={{
    ...WordCardPresets.analysis.actions,
    isAlreadyInCollection: isDupe,
  }}
  isPlayingAudio={isPlaying}
  onPlayPronunciation={handlePlay}
  onChangeImage={handleImage}
/>
```

### Вместо ReviewCard/CardBack:

```tsx
// Было - множество отдельных компонентов
<CardBack
  currentWord={word}
  onChangeImage={handleImage}
  onPlayPronunciation={handlePlay}
  onDeleteWord={handleDelete}
/>

// Стало - один универсальный
<UniversalWordCard
  word={word}
  config={WordCardPresets.review.config}
  actions={{
    ...WordCardPresets.review.actions,
    onDelete: handleDelete,
  }}
  onChangeImage={handleImage}
  onPlayPronunciation={handlePlay}
/>
```

## Типы данных

Компонент автоматически определяет тип данных и работает с:

- `Word` - слово из базы данных
- `WordAnalysisResponse` - результат анализа от Gemini

## Преимущества

- **Единообразие**: одинаковый вид и поведение везде
- **Простота поддержки**: изменения в одном месте
- **Полнота**: все новые поля поддерживаются автоматически
- **Гибкость**: настраивается под любой сценарий использования
- **Готовые решения**: пресеты для типичных случаев

## Следующие шаги

1. Обновить базу данных для поддержки новых полей
2. Обновить Gemini Edge Function для возврата новых полей
3. Заменить существующие компоненты на UniversalWordCard
4. Протестировать все сценарии использования
