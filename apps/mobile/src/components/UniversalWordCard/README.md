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
import { UniversalWordCard, WordCardPresets } from '@/components/UniversalWordCard'

// По умолчанию - максимальная информация!
<UniversalWordCard word={wordData} />

// С пресетом (переопределяет только отличия)
<UniversalWordCard
  word={wordData}
  config={WordCardPresets.modal.config}
  actions={WordCardPresets.modal.actions}
/>
```

## Пресеты - только отличия!

**Основной принцип:** По умолчанию показывается **максимальная информация**. Пресеты переопределяют только то, что нужно изменить.

### 1. Full (по умолчанию)

```tsx
// Максимальная информация - все поля видимы
<UniversalWordCard word={word} />
// ИЛИ явно
<UniversalWordCard word={word} config={WordCardPresets.full.config} />
```

### 2. Modal - добавляет прогресс изучения

```tsx
<UniversalWordCard
  word={word}
  config={WordCardPresets.modal.config} // scrollable: false
  actions={WordCardPresets.modal.actions} // + прогресс + статус
/>
```

### 3. Analysis - добавляет проверку дубликатов

```tsx
<UniversalWordCard
  word={analysisResult}
  config={WordCardPresets.analysis.config} // максимальная информация
  actions={{
    ...WordCardPresets.analysis.actions, // + дубликаты + сохранение
    isDuplicateChecking: isChecking,
    onSave: handleSave,
  }}
/>
```

### 4. Review - убирает отвлекающие элементы

```tsx
<UniversalWordCard
  word={currentWord}
  config={WordCardPresets.review.config} // - синонимы/антонимы/грамматика
  actions={{
    ...WordCardPresets.review.actions, // + удаление
    onDelete: handleDelete,
  }}
/>
```

### 5. Compact - минимум информации

```tsx
<UniversalWordCard
  word={word}
  config={WordCardPresets.compact.config} // только основное
/>
```

## Кастомная конфигурация

```tsx
// По умолчанию ВСЕ поля включены! Отключаем только то, что не нужно
<UniversalWordCard
  word={word}
  config={{
    // Убрать примеры и изображения
    showExamples: false,
    showImage: false,
  }}
  actions={{
    // Добавить кнопку удаления
    showDeleteButton: true,
    onDelete: handleDelete,
  }}
/>

// Максимально полная конфигурация (по умолчанию):
// showHeader: true ✅
// showTranslations: true ✅
// showExamples: true ✅
// showImage: true ✅
// showSynonyms: true ✅ 🆕
// showAntonyms: true ✅ 🆕
// showGrammarInfo: true ✅
// showConjugation: true ✅ 🆕
// enablePronunciation: true ✅
// enableImageChange: true ✅
// scrollable: true ✅
// compact: false ✅
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
