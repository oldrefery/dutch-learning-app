# E2E Test IDs Reference

This document lists all testID props added to components for end-to-end testing with Maestro.

## Test ID Naming Convention

All test IDs follow kebab-case naming convention as per React Native best practices:

- Use lowercase letters
- Separate words with hyphens
- Be descriptive and specific
- Group related elements with common prefixes

## Add Word Screen

### Input Components

| Test ID               | Component            | Description                         |
| --------------------- | -------------------- | ----------------------------------- |
| `word-input`          | TextInput            | Main Dutch word input field         |
| `analyze-button`      | GlassIconButton      | AI analysis button (sparkles icon)  |
| `collection-selector` | TouchableOpacity     | Collection selector dropdown        |
| `save-word-button`    | FloatingActionButton | Floating action button to save word |

**Usage Example:**

```yaml
- tapOn:
    id: 'word-input'
- inputText: 'lopen'
- tapOn:
    id: 'analyze-button'
- tapOn:
    id: 'save-word-button'
```

---

## Word Management (Swipeable Actions)

### SwipeableWordItem

| Test ID              | Component        | Description                          |
| -------------------- | ---------------- | ------------------------------------ |
| `word-delete-button` | TouchableOpacity | Delete button revealed on swipe left |
| `word-move-button`   | TouchableOpacity | Move button revealed on swipe right  |

**Usage Example:**

```yaml
# Swipe left to reveal delete
- swipe:
    direction: LEFT
    on:
      text: 'wordname'
    distance: 40%
- tapOn:
    id: 'word-delete-button'
```

---

## Collection Management (Swipeable Actions)

### SwipeableCollectionCard

| Test ID                    | Component        | Description                                    |
| -------------------------- | ---------------- | ---------------------------------------------- |
| `collection-rename-button` | TouchableOpacity | Rename button revealed on swipe left           |
| `collection-delete-button` | TouchableOpacity | Delete button revealed on swipe left (further) |

**Usage Example:**

```yaml
# Swipe left to reveal actions
- swipe:
    direction: LEFT
    on:
      text: 'Collection Name'
    distance: 40%
- tapOn:
    id: 'collection-rename-button'
```

---

## Review Screen (Pending Implementation)

### Flashcard Components (To Be Added)

| Test ID               | Component        | Description                              |
| --------------------- | ---------------- | ---------------------------------------- |
| `flashcard-container` | View             | Main flashcard container for tap-to-flip |
| `review-button-again` | TouchableOpacity | SRS "Again" button                       |
| `review-button-hard`  | TouchableOpacity | SRS "Hard" button                        |
| `review-button-good`  | TouchableOpacity | SRS "Good" button                        |
| `review-button-easy`  | TouchableOpacity | SRS "Easy" button                        |
| `review-progress`     | Text             | Progress counter (e.g., "5 / 20")        |

**Planned Usage:**

```yaml
# Tap to flip card
- tapOn:
    id: 'flashcard-container'
# Rate word
- tapOn:
    id: 'review-button-good'
```

---

## Word Detail Modal (Pending Implementation)

### Modal Components (To Be Added)

| Test ID                | Component        | Description              |
| ---------------------- | ---------------- | ------------------------ |
| `word-detail-modal`    | BottomSheet      | Main modal container     |
| `pronunciation-button` | TouchableOpacity | TTS playback button      |
| `change-image-button`  | TouchableOpacity | Change word image button |
| `word-detail-close`    | TouchableOpacity | Close/dismiss button     |

---

## Collection Modals (Pending Implementation)

### Create/Rename Collection

| Test ID                     | Component        | Description                 |
| --------------------------- | ---------------- | --------------------------- |
| `collection-name-input`     | TextInput        | Collection name input field |
| `collection-create-button`  | TouchableOpacity | Create collection button    |
| `collection-rename-confirm` | TouchableOpacity | Rename confirmation button  |
| `collection-modal-cancel`   | TouchableOpacity | Cancel button               |

### Move Word Modal

| Test ID                    | Component        | Description                                         |
| -------------------------- | ---------------- | --------------------------------------------------- |
| `move-to-collection-modal` | Modal            | Move word modal container                           |
| `collection-list-item`     | TouchableOpacity | Individual collection in list (with dynamic suffix) |

---

## Collections Screen

### Main Screen Components

| Test ID                    | Component          | Description                               |
| -------------------------- | ------------------ | ----------------------------------------- |
| `create-collection-button` | GlassCapsuleButton | Create collection button in SectionHeader |
| `import-collection-button` | GlassCapsuleButton | Import collection button in SectionHeader |
| `collection-card`          | TouchableOpacity   | Collection card (with dynamic suffix)     |
| `stats-review-button`      | TouchableOpacity   | "Review Now" button in stats card         |

**Usage Example:**

```yaml
- tapOn:
    id: 'create-collection-button'
```

---

## Navigation (Already Implemented via Text)

Navigation tabs use text selectors as they're React Navigation components:

```yaml
- tapOn:
    text: 'Collections'
- tapOn:
    text: 'Add Word'
- tapOn:
    text: 'Review'
- tapOn:
    text: 'History'
- tapOn:
    text: 'Settings'
```

---

## Test ID Status Summary

### ✅ Implemented

- Add Word Screen input components
- Word swipe actions (delete/move)
- Collection swipe actions (rename/delete)
- Save word button
- Collections screen buttons (create/import)

### ⏳ Pending Implementation

- Review screen SRS buttons
- Word Detail Modal components
- Collection modals (create/rename/import input fields)
- Search bars
- Stats review button

---

## Best Practices

### When Adding Test IDs

1. **Always use kebab-case**

   ```typescript
   // Good
   testID = 'word-input'
   testID = 'analyze-button'

   // Bad
   testID = 'wordInput'
   testID = 'analyze_button'
   ```

2. **Be descriptive and specific**

   ```typescript
   // Good
   testID = 'collection-delete-button'

   // Bad
   testID = 'btn1'
   testID = 'delete'
   ```

3. **Use common prefixes for related elements**

   ```typescript
   testID = 'review-button-again'
   testID = 'review-button-hard'
   testID = 'review-button-good'
   testID = 'review-button-easy'
   ```

4. **Add testID to the outermost interactive element**

   ```typescript
   // Good
   <TouchableOpacity testID="save-button">
     <Text>Save</Text>
   </TouchableOpacity>

   // Bad - testID on Text won't work for tap
   <TouchableOpacity>
     <Text testID="save-button">Save</Text>
   </TouchableOpacity>
   ```

### In Maestro Tests

1. **Prefer testID over text when available**

   ```yaml
   # Good - more reliable
   - tapOn:
       id: 'word-input'

   # OK - use when testID not available
   - tapOn:
       text: 'Collections'
   ```

2. **Use text selectors for dynamic content**

   ```yaml
   # Good - collection name is dynamic
   - tapOn:
       text: 'My Collection'

   # Bad - can't predict collection_id
   - tapOn:
       id: 'collection-abc123'
   ```

3. **Combine selectors when needed**
   ```yaml
   # Swipe on element, then tap testID
   - swipe:
       direction: LEFT
       on:
         text: 'word text'
   - tapOn:
       id: 'word-delete-button'
   ```

---

## Adding New Test IDs

When adding test IDs to new components:

1. **Update the component:**

   ```typescript
   interface MyComponentProps {
     testID?: string
     // other props...
   }

   export function MyComponent({ testID, ...props }: MyComponentProps) {
     return (
       <TouchableOpacity testID={testID} {...props}>
         {/* component content */}
       </TouchableOpacity>
     )
   }
   ```

2. **Update this documentation**
   - Add to appropriate section
   - Include component name and description
   - Provide usage example

3. **Update test files**
   - Replace coordinate/index-based selectors
   - Use testID for more reliable tests

4. **Test the implementation**
   ```bash
   maestro test .maestro/your-test.yaml --verbose
   ```

---

## Troubleshooting

### Test ID Not Found

1. Verify testID prop is on interactive element (TouchableOpacity, Pressable, Button)
2. Check component accepts and passes testID prop
3. Ensure app is rebuilt after adding testID
4. Use Maestro Studio to inspect element:
   ```bash
   maestro studio
   ```

### Swipe Actions Not Working

1. Swipe on the text/element first
2. Then tap the revealed button by testID:
   ```yaml
   - swipe:
       direction: LEFT
       on:
         text: 'element text'
   - tapOn:
       id: 'button-test-id'
   ```

### Dynamic Content

For dynamic content, combine text and testID:

```yaml
# Find by text, interact by testID
- assertVisible: 'Dynamic Text'
- tapOn:
    id: 'static-button-id'
```
