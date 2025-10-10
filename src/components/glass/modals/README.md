# Glass Modal Components

## GlassModalCenter

Универсальный центрированный модальный компонент с эффектом "жидкого стекла" (Liquid Glass).

### Особенности

- ✅ Плавные анимации появления/исчезновения
- ✅ Поддержка клавиатуры (KeyboardAvoidingView)
- ✅ Настраиваемые действия (левая и правая кнопки)
- ✅ Адаптивная ширина и высота
- ✅ Accessibility labels
- ✅ Поддержка тёмной темы

### API

```typescript
type GlassModalCenterAction = {
  label: string
  onPress: () => void
  disabled?: boolean
  accessibilityLabel?: string
}

type GlassModalCenterProps = {
  visible: boolean
  title: string
  onClose: () => void
  leftAction?: GlassModalCenterAction
  rightAction?: GlassModalCenterAction
  children: React.ReactNode
  minHeight?: number
  width?: string
  maxWidth?: number
}
```

### Примеры использования

#### 1. Переименование коллекции (RenameCollectionSheet)

```tsx
import { GlassModalCenter } from '@/components/glass/modals/GlassModalCenter'
;<GlassModalCenter
  visible={visible}
  title="Rename Collection"
  onClose={onClose}
  leftAction={{
    label: 'Cancel',
    onPress: onClose,
  }}
  rightAction={{
    label: 'Save',
    onPress: handleSave,
    disabled: !canSave,
  }}
>
  <TextInput
    value={name}
    onChangeText={setName}
    placeholder="Enter collection name"
  />
</GlassModalCenter>
```

#### 2. Создание новой коллекции

```tsx
<GlassModalCenter
  visible={visible}
  title="New Collection"
  onClose={onClose}
  leftAction={{
    label: 'Cancel',
    onPress: onClose,
  }}
  rightAction={{
    label: 'Create',
    onPress: handleCreate,
    disabled: !canCreate,
  }}
>
  <View>
    <TextThemed>Collection Name</TextThemed>
    <TextInput
      value={name}
      onChangeText={setName}
      placeholder="Enter collection name"
    />
  </View>
</GlassModalCenter>
```

#### 3. Произвольный контент

```tsx
<GlassModalCenter
  visible={visible}
  title="Choose Collection"
  onClose={onClose}
  rightAction={{
    label: 'Done',
    onPress: handleDone,
  }}
>
  <FlatList
    data={collections}
    renderItem={({ item }) => (
      <TouchableOpacity onPress={() => selectCollection(item)}>
        <Text>{item.name}</Text>
      </TouchableOpacity>
    )}
  />
</GlassModalCenter>
```

#### 4. Модал с одной кнопкой

```tsx
<GlassModalCenter
  visible={visible}
  title="Information"
  onClose={onClose}
  rightAction={{
    label: 'OK',
    onPress: onClose,
  }}
>
  <Text>Some information message</Text>
</GlassModalCenter>
```

## Готовые компоненты на базе GlassModalCenter

### RenameCollectionSheet

Модальное окно для переименования коллекции.

```tsx
import RenameCollectionSheet from '@/components/glass/modals/RenameCollectionSheet'
;<RenameCollectionSheet
  visible={visible}
  currentName={collection.name}
  onClose={handleClose}
  onRename={async newName => {
    await updateCollection(id, newName)
  }}
/>
```

### CreateCollectionSheet

Модальное окно для создания новой коллекции.

```tsx
import CreateCollectionSheet from '@/components/glass/modals/CreateCollectionSheet'

;<CreateCollectionSheet
  visible={visible}
  onClose={handleClose}
  onCollectionCreated={collection => {
    // Collection is automatically added to the store
    console.log('Created:', collection)
  }}
/>
```

## Рекомендации

1. **Для простых форм с одним полем** - используйте готовые компоненты (RenameCollectionSheet, CreateCollectionSheet)
2. **Для сложных форм** - создавайте новые компоненты на базе GlassModalCenter
3. **Для списков выбора** - используйте GlassModalCenter с FlatList или ScrollView внутри
4. **Валидация** - обрабатывайте в родительском компоненте и управляйте `disabled` состоянием `rightAction`

## Архитектура

```
GlassModalCenter (универсальный)
  ├── RenameCollectionSheet (переименование)
  ├── CreateCollectionSheet (создание)
  └── ... (будущие компоненты)
```

Все специфичные модалы должны использовать `GlassModalCenter` в качестве базы для консистентности UX.
