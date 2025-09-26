# Technical Improvements & Future Features

## ⚡ Current Issue: Word Uniqueness Based on Semantic Context

### 1. The Problem We Are Solving

Currently, our word uniqueness system only checks `dutch_lemma`, which prevents users from adding semantically different words that happen to share the same spelling. This creates significant limitations in Dutch language learning:

**Examples of Currently Blocked but Valid Combinations:**

- **`het haar`** (noun, uncountable: "hair" - волосы, собирательно) vs **`de haar`** (noun, countable: "a hair" - отдельный волос)
- **`het idee`** (noun: "idea" - общая идея) vs **`de idee`** (noun: more philosophical "concept/idea" - философская концепция)
- **`haar`** as pronoun ("her" - местоимение) vs **`het haar`** as noun ("hair" - волосы)

### 2. The Root Cause

Our current uniqueness logic in `checkWordExists()` only considers:

```sql
.eq('dutch_lemma', normalizedLemma)
```

This ignores the critical semantic distinctions provided by:

- `part_of_speech` - Different grammatical categories
- `article` - Essential for Dutch noun semantics (`de` vs `het`)

### 3. The Solution

Implement **Semantic Uniqueness** that considers the full linguistic context:

**New Uniqueness Key:** `user_id + dutch_lemma + part_of_speech + article`

### 4. Technical Implementation Plan

#### Database Schema Changes:

1. **Update `words` table uniqueness:**

   ```sql
   CREATE UNIQUE INDEX idx_words_semantic_unique
   ON words(user_id, dutch_lemma, part_of_speech, COALESCE(article, ''));
   ```

2. **Update `word_analysis_cache` uniqueness:**
   ```sql
   CREATE UNIQUE INDEX idx_cache_semantic_unique
   ON word_analysis_cache(dutch_lemma, part_of_speech, COALESCE(article, ''));
   ```

#### Code Changes Required:

1. **Update `checkWordExists()` function:**

   ```typescript
   async checkWordExists(
     userId: string,
     dutchLemma: string,
     partOfSpeech?: string,
     article?: string
   )
   ```

2. **Update cache key generation:**
   - From: `dutch_lemma`
   - To: `${dutch_lemma}|${part_of_speech}|${article || 'null'}`

3. **Update duplicate checking logic throughout the application**

#### Frontend Changes:

- Update duplicate detection in `AddWordScreen`
- Update import duplicate checking in `useImportSelection`
- Ensure UI properly handles multiple variants of the same lemma

### 5. Expected Outcomes

**Users will be able to add all valid combinations:**

- ✅ `het haar` (hair, collective)
- ✅ `de haar` (a single hair)
- ✅ `haar` (pronoun: her)
- ✅ `het idee` (idea, general)
- ✅ `de idee` (idea, philosophical concept)

**Cache will work correctly:**

- Each semantic variant will have its own cache entry
- No cache collisions between different meanings
- Proper cache hits for identical semantic contexts

### 6. Priority: High

This is a fundamental limitation that prevents users from learning Dutch properly, as the `de/het` distinction is crucial in Dutch grammar and semantics.

---

## Feature Enhancement: Word Disambiguation - Choosing the Right Meaning

### 1. The Problem We Are Solving

In Dutch, some words are spelled identically but have completely different meanings. These are called homonyms. For example:

- **"haar"** can mean "hair" (as in 'het haar') or the pronoun "her"
- **"bij"** can mean "bee" (as in 'de bij') or the preposition "near"
- **"idee"** can be "idea" ('het idee') or a more philosophical "concept" ('de idee')

Currently, if a user enters an ambiguous word like "haar" without context (like an article), our AI assistant, Gemini, has to guess which meaning the user intended. It usually picks the most common one, but this can be incorrect and lead to an inaccurate analysis.

### 2. How We Plan to Solve It

Instead of guessing, we will empower the user to make the correct choice. The application will detect when a word has multiple common meanings and will ask the user to select the one they want to add. This approach turns a potential point of confusion into a valuable learning opportunity.

### 3. The Steps to Implement This Solution

#### Step 1: Teach the AI to Provide Multiple Options

We will update the instructions we send to our AI assistant, Gemini. The new instruction will be: "If a word has several common meanings, do not just send back the most popular one. Instead, prepare a separate, complete analysis for each meaning and send them all back as a list."

#### Step 2: Update Our Server to Handle the List

Our backend logic (the Supabase Edge Function) that communicates with the AI will be updated. It will be able to recognize when the AI sends back a list of analyses instead of just a single one. When it receives a list, it will forward the entire list to the mobile application.

#### Step 3: Create a Selection Menu in the App

When the mobile application receives a list of word analyses, it will display a simple and clear pop-up menu for the user. For example, if the user types "haar", they will see a screen asking:

**"Which meaning did you intend for 'haar'?"**

- **Option 1:** het haar (noun: hair)
- **Option 2:** de haar (noun: a hair)
- **Option 3:** haar (pronoun: her)

The user will simply tap on the correct option. The app will then proceed to show the detailed analysis for only the version they selected.

### 4. The Benefits for the User

This enhancement will provide several key benefits:

- **Accuracy:** The user will always get an analysis for the exact word they intended to learn
- **User Control:** The user is in control of the process, eliminating guesswork and potential frustration
- **Better Learning:** The app actively teaches the user about the nuances and multiple meanings of Dutch words
- **Efficiency:** A single request to the AI will provide all possible meanings, saving time and making the process faster

### 5. Technical Implementation Plan

#### Frontend Changes Required:

- Create new `WordDisambiguationModal` component
- Update `WordAnalysisService` to handle array responses
- Modify `addWord` flow to support disambiguation selection
- Add loading states for disambiguation UI

#### Backend Changes Required:

- Update Gemini prompt templates in `gemini-handler` Edge Function
- Modify response parsing to handle multiple analyses
- Update database schema if needed for disambiguation tracking
- Add new response type definitions

#### Database Changes:

- Consider adding `disambiguation_id` or `meaning_variant` fields to word entries
- Track which meaning was selected for analytics

### 6. Priority: Medium-High

This feature significantly improves user experience and learning accuracy, making it a valuable addition to the app's core functionality.

---

## Other Future Features

### Multi-language Support

- Add support for other source languages (German, French, Spanish)
- Implement language detection for input text

### Advanced Spaced Repetition

- Implement difficulty-based scheduling
- Add performance analytics and adaptive learning

### Voice Recognition

- Speech-to-text for pronunciation practice
- Audio pronunciation feedback

### Social Learning Features

- Share collections with friends
- Community-driven word lists
- Learning progress sharing

### Advanced Analytics

- Detailed learning progress tracking
- Weak areas identification
- Personalized study recommendations
