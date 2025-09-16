# Phase 4.0: Access Control & Smart Analysis - Technical Breakdown

## Status: Implementation Plan for Tiered Access and Intelligent Caching

---

## 🎯 OVERVIEW

Phase 4.0 introduces tiered access control to manage API costs while enabling broader user access, smart word analysis caching to reduce duplicate AI calls, and enhanced review experience with contextual information.

### Key Objectives:

- **Cost Control**: Only full access users consume Gemini API quota
- **User Growth**: Read-only users can learn without API cost impact
- **Efficiency**: Reuse existing word analysis to minimize API calls
- **UX Enhancement**: Provide contextual information without disrupting learning flow

---

## 📊 DATABASE CHANGES

### 1. Email Allowlist System

```sql
-- Pre-approval system for user access control
CREATE TABLE email_allowlist (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  access_level text NOT NULL DEFAULT 'read_only', -- 'full' | 'read_only'
  added_by text, -- admin tracking
  added_at timestamptz DEFAULT now(),
  activated_at timestamptz, -- when user registered
  notes text -- optional admin notes
);

-- Add access level to users table
ALTER TABLE users ADD COLUMN access_level text DEFAULT 'read_only';

-- Create index for fast email lookups
CREATE INDEX idx_email_allowlist_email ON email_allowlist(email);
```

### 2. Auto-Assignment Trigger

```sql
-- Function to assign access level upon registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Set access level based on allowlist
  UPDATE users
  SET access_level = (
    SELECT COALESCE(ea.access_level, 'read_only')
    FROM email_allowlist ea
    WHERE ea.email = NEW.email
  )
  WHERE id = NEW.id;

  -- Mark activation in allowlist
  UPDATE email_allowlist
  SET activated_at = now()
  WHERE email = NEW.email AND activated_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 3. Row Level Security Policies

```sql
-- Restrict AI analysis to full access users
CREATE POLICY "Only full access can analyze words" ON words
  FOR INSERT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND access_level = 'full'
    )
  );

-- Restrict image updates to full access users
CREATE POLICY "Only full access can update images" ON words
  FOR UPDATE USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND access_level = 'full'
    )
  );

-- Restrict collection creation to full access users
CREATE POLICY "Only full access can create collections" ON collections
  FOR INSERT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND access_level = 'full'
    )
  );

-- All users can read their own data
CREATE POLICY "Users can read own data" ON words
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can read own collections" ON collections
  FOR SELECT USING (user_id = auth.uid());
```

---

## 🧠 SMART ANALYSIS CACHE IMPLEMENTATION

### 1. Enhanced Word Analysis Service

```typescript
// services/wordAnalysisService.ts
export interface AnalysisResult {
  fromCache: boolean
  duplicate: boolean
  analysis?: WordAnalysis
  existingWord?: Word
  location?: string
  message?: string
}

export const analyzeWordSmart = async (
  word: string,
  forceAI = false
): Promise<AnalysisResult> => {
  const normalizedWord = word.trim().toLowerCase()
  const currentUserId = getCurrentUserId()

  // 1. Check if user already has this word
  const userExisting = await supabase
    .from('words')
    .select(
      `
      *,
      collections(name)
    `
    )
    .eq('user_id', currentUserId)
    .eq('dutch_lemma', normalizedWord)
    .single()

  if (userExisting.data) {
    return {
      duplicate: true,
      location: `in "${userExisting.data.collections.name}"`,
      existingWord: userExisting.data,
    }
  }

  // 2. If not forcing AI, check cache (other users' words)
  if (!forceAI) {
    const cachedAnalysis = await supabase
      .from('words')
      .select(
        `
        dutch_lemma,
        dutch_original,
        part_of_speech,
        translations,
        examples,
        image_url,
        tts_url,
        article
      `
      )
      .eq('dutch_lemma', normalizedWord)
      .limit(1)
      .single()

    if (cachedAnalysis.data) {
      return {
        fromCache: true,
        analysis: cachedAnalysis.data,
        message: 'Found existing analysis! ✨',
      }
    }
  }

  // 3. Only full access users can make AI calls
  const userAccess = await getUserAccessLevel(currentUserId)
  if (userAccess !== 'full') {
    throw new Error('AI analysis requires full access. Contact administrator.')
  }

  // 4. Make AI analysis call
  const aiAnalysis = await callGeminiAPI(word)
  return { fromCache: false, analysis: aiAnalysis }
}

// Helper function to get user access level
const getUserAccessLevel = async (userId: string): Promise<string> => {
  const { data } = await supabase
    .from('users')
    .select('access_level')
    .eq('id', userId)
    .single()

  return data?.access_level || 'read_only'
}
```

### 2. Cache Statistics Tracking

```typescript
// services/cacheStatsService.ts
export const trackCacheUsage = async (
  wordAnalyzed: string,
  fromCache: boolean,
  userId: string
) => {
  // Simple logging for analytics
  console.log(`Word: ${wordAnalyzed}, Cache: ${fromCache}, User: ${userId}`)

  // Could extend with actual analytics table if needed
  // INSERT INTO analysis_stats (word, from_cache, user_id, timestamp)
}

export const getCacheStatistics = async () => {
  // Count total unique words vs total user words for cache hit rate
  const { data: uniqueWords } = await supabase
    .from('words')
    .select('dutch_lemma')
    .group('dutch_lemma')

  const { data: totalWords } = await supabase.from('words').select('count(*)')

  const cacheHitRate =
    uniqueWords?.length && totalWords?.length
      ? ((totalWords.length - uniqueWords.length) / totalWords.length) * 100
      : 0

  return {
    uniqueWords: uniqueWords?.length || 0,
    totalWords: totalWords?.[0]?.count || 0,
    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    apiCallsSaved: (totalWords?.[0]?.count || 0) - (uniqueWords?.length || 0),
  }
}
```

---

## 🎨 UI ADAPTATIONS FOR ACCESS LEVELS

### 1. Access Level Context

```typescript
// contexts/AccessLevelContext.tsx
interface AccessLevelContextType {
  accessLevel: 'full' | 'read_only'
  isFullAccess: boolean
  isReadOnly: boolean
}

export const AccessLevelProvider = ({ children }) => {
  const [accessLevel, setAccessLevel] = useState<'full' | 'read_only'>('read_only')
  const { currentUserId } = useApplicationStore()

  useEffect(() => {
    const fetchAccessLevel = async () => {
      if (currentUserId) {
        const level = await getUserAccessLevel(currentUserId)
        setAccessLevel(level)
      }
    }
    fetchAccessLevel()
  }, [currentUserId])

  return (
    <AccessLevelContext.Provider value={{
      accessLevel,
      isFullAccess: accessLevel === 'full',
      isReadOnly: accessLevel === 'read_only'
    }}>
      {children}
    </AccessLevelContext.Provider>
  )
}
```

### 2. Read-Only Add Word Screen

```typescript
// components/ReadOnlyAddWordScreen.tsx
export const ReadOnlyAddWordScreen = () => {
  const navigation = useNavigation()

  return (
    <ViewThemed style={styles.container}>
      <ViewThemed style={styles.infoCard}>
        <Ionicons
          name="information-circle"
          size={64}
          color={Colors.info.DEFAULT}
        />
        <TextThemed style={styles.title}>
          Import Collections to Start Learning
        </TextThemed>
        <TextThemed style={styles.description}>
          You can import shared collections from other users and begin your
          Dutch learning journey immediately!
        </TextThemed>

        <TouchableOpacity
          style={styles.importButton}
          onPress={handleImportFromLink}
        >
          <Ionicons name="download-outline" size={20} />
          <TextThemed style={styles.buttonText}>
            Import Collection
          </TextThemed>
        </TouchableOpacity>
      </ViewThemed>

      <ViewThemed style={styles.upgradeCard}>
        <TextThemed style={styles.upgradeTitle}>
          Want to Create Your Own Words?
        </TextThemed>
        <TextThemed style={styles.upgradeDescription}>
          Get full access to create collections, analyze words with AI,
          and customize your learning experience.
        </TextThemed>
        <TextThemed style={styles.contactText}>
          Contact the administrator for upgrade access.
        </TextThemed>
      </ViewThemed>
    </ViewThemed>
  )
}
```

### 3. Smart Analysis UI Components

```typescript
// components/AnalysisCacheAlert.tsx
interface CacheAlertProps {
  fromCache: boolean
  onForceReAnalysis: () => void
}

export const AnalysisCacheAlert = ({ fromCache, onForceReAnalysis }) => {
  if (!fromCache) return null

  return (
    <ViewThemed style={styles.cacheAlert}>
      <Ionicons name="flash" size={20} color={Colors.success.DEFAULT} />
      <ViewThemed style={styles.cacheContent}>
        <TextThemed style={styles.cacheText}>
          Found existing analysis! ✨
        </TextThemed>
        <TouchableOpacity
          style={styles.reAnalyzeButton}
          onPress={onForceReAnalysis}
        >
          <TextThemed style={styles.reAnalyzeText}>
            Re-analyze with AI
          </TextThemed>
          <Ionicons name="refresh" size={16} />
        </TouchableOpacity>
      </ViewThemed>
    </ViewThemed>
  )
}
```

---

## 🔍 REVIEW SCREEN INFO BUTTON

### 1. Minimal Info Button Implementation

```typescript
// In review.tsx - updated header
<ViewThemed style={reviewScreenStyles.progressContainer}>
  <TextThemed style={reviewScreenStyles.progressText}>
    {currentWordNumber} / {totalWords}
  </TextThemed>

  <TouchableOpacity
    onPress={showWordInfo}
    style={reviewScreenStyles.infoButton}
    accessibilityLabel="Show word details"
  >
    <Ionicons
      name="information-circle-outline"
      size={20}
      color={Colors.neutral[500]}
    />
  </TouchableOpacity>
</ViewThemed>
```

### 2. Word Info Modal

```typescript
// components/WordInfoModal.tsx
interface WordInfoModalProps {
  visible: boolean
  word: Word | null
  onClose: () => void
}

export const WordInfoModal = ({ visible, word, onClose }) => {
  if (!word) return null

  return (
    <Modal
      visible={visible}
      presentationStyle="formSheet"
      animationType="slide"
    >
      <ViewThemed style={styles.container}>
        <ViewThemed style={styles.header}>
          <TextThemed style={styles.title}>Word Details</TextThemed>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.neutral[700]} />
          </TouchableOpacity>
        </ViewThemed>

        <ScrollView style={styles.content}>
          <ViewThemed style={styles.wordSection}>
            <TextThemed style={styles.word}>{word.dutch_lemma}</TextThemed>
            {word.article && (
              <TextThemed style={styles.article}>{word.article}</TextThemed>
            )}
            <TextThemed style={styles.partOfSpeech}>
              {word.part_of_speech}
            </TextThemed>
          </ViewThemed>

          <ViewThemed style={styles.collectionSection}>
            <TextThemed style={styles.sectionTitle}>Collection</TextThemed>
            <TextThemed style={styles.collectionName}>
              {word.collection_name || 'Unknown Collection'}
            </TextThemed>
          </ViewThemed>

          <ViewThemed style={styles.srsSection}>
            <TextThemed style={styles.sectionTitle}>Learning Progress</TextThemed>
            <ViewThemed style={styles.srsRow}>
              <TextThemed style={styles.srsLabel}>Interval:</TextThemed>
              <TextThemed style={styles.srsValue}>
                {word.interval_days} days
              </TextThemed>
            </ViewThemed>
            <ViewThemed style={styles.srsRow}>
              <TextThemed style={styles.srsLabel}>Reviews:</TextThemed>
              <TextThemed style={styles.srsValue}>
                {word.repetition_count}
              </TextThemed>
            </ViewThemed>
            <ViewThemed style={styles.srsRow}>
              <TextThemed style={styles.srsLabel}>Difficulty:</TextThemed>
              <TextThemed style={styles.srsValue}>
                {word.easiness_factor.toFixed(1)}
              </TextThemed>
            </ViewThemed>
            <ViewThemed style={styles.srsRow}>
              <TextThemed style={styles.srsLabel}>Next Review:</TextThemed>
              <TextThemed style={styles.srsValue}>
                {formatDate(word.next_review_date)}
              </TextThemed>
            </ViewThemed>
          </ViewThemed>
        </ScrollView>
      </ViewThemed>
    </Modal>
  )
}
```

---

## 🚀 IMPLEMENTATION ORDER

### Phase 4.0.1: Database & Access Control (Priority 1)

1. Create `email_allowlist` table and add `access_level` to users
2. Implement auto-assignment trigger for new users
3. Add RLS policies for access control
4. Create admin interface for managing allowlist

### Phase 4.0.2: Smart Analysis Cache (Priority 2)

1. Update `analyzeWordSmart` function with cache logic
2. Add force re-analysis option to UI
3. Implement cache hit notifications
4. Add cache statistics tracking

### Phase 4.0.3: Read-Only User Experience (Priority 3)

1. Create `AccessLevelProvider` context
2. Implement read-only add word screen
3. Adapt existing screens for access levels
4. Add upgrade messaging and contact information

### Phase 4.0.4: Review Info Enhancement (Priority 4)

1. Add info button to review screen header
2. Implement word info modal with collection and SRS data
3. Ensure minimal impact on learning flow
4. Add accessibility features

---

## 📊 SUCCESS METRICS

### Primary KPIs:

- **API Cost Reduction**: Percentage decrease in Gemini API calls
- **Cache Hit Rate**: Percentage of words found in cache vs new analysis
- **User Conversion**: Read-only to full access upgrade rate
- **User Retention**: Retention rate for read-only vs full access users

### Secondary Metrics:

- **Time to First Learn**: How quickly new read-only users start learning
- **Collection Import Rate**: Percentage of read-only users who import collections
- **Support Requests**: Reduction in access-related support tickets
- **Database Efficiency**: Query performance with new RLS policies

---

## 🛡️ SECURITY CONSIDERATIONS

### Access Control:

- RLS policies prevent unauthorized AI usage
- Email allowlist prevents unlimited user registration
- Read-only users cannot create content that costs API calls

### Data Privacy:

- Users can only see their own words and collections
- Cache system doesn't expose private user data
- Admin tracking maintains audit trail

### Performance:

- Indexed email lookups for fast access level checks
- Efficient cache queries using existing word table structure
- Minimal overhead from access level context

---

_This technical breakdown provides a comprehensive implementation guide for Phase 4.0, focusing on cost control, user growth, and enhanced user experience._
