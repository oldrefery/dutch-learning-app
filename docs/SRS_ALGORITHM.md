# Spaced Repetition System (SRS) Algorithm

## Overview

The Dutch Learning App implements a spaced repetition system based on the SuperMemo SM-2 algorithm. This system optimizes the timing of flashcard reviews to maximize long-term retention while minimizing study time.

## Core Concepts

### Assessment Options

When reviewing a flashcard, users can choose from four assessment options:

- **Again** 🔴: Couldn't remember at all
- **Hard** 🟡: Remembered with difficulty
- **Good** 🟢: Remembered correctly
- **Easy** 🔵: Remembered easily and quickly

### SRS Parameters

Each word in the system tracks three key parameters:

1. **Interval Days**: Number of days until next review
2. **Repetition Count**: How many times the word has been successfully reviewed
3. **Easiness Factor**: Multiplier that determines how quickly intervals increase (1.3 - 2.5)

## Algorithm Details

### Initial Values

When a word is first added to the system:

- `interval_days`: 0 (available for immediate review)
- `repetition_count`: 0
- `easiness_factor`: 2.5 (maximum difficulty)

### Assessment Impact

#### Again 🔴 - Complete Reset

```
Easiness Factor: -0.2 (minimum 1.3)
Repetition Count: Reset to 0
Interval: 0 days (immediate re-review)
```

**Example:**

- Before: EF=2.1, Count=5, Interval=21 days
- After: EF=1.9, Count=0, Interval=0 days

#### Hard 🟡 - Slight Penalty

```
Easiness Factor: -0.15 (minimum 1.3)
Repetition Count: +1
Interval: Previous × 1.2 (minimum 1 day)
```

**Example:**

- Before: EF=2.1, Count=3, Interval=14 days
- After: EF=1.95, Count=4, Interval=17 days

#### Good 🟢 - Standard Progression

```
Easiness Factor: No change
Repetition Count: +1
Interval: SM-2 standard progression
```

**Interval Calculation:**

- 1st repetition: 1 day
- 2nd repetition: 6 days
- 3rd+ repetition: Previous interval × Easiness Factor

**Example:**

- Before: EF=2.1, Count=2, Interval=6 days
- After: EF=2.1, Count=3, Interval=13 days (6 × 2.1)

#### Easy 🔵 - Accelerated Learning

```
Easiness Factor: +0.15 (maximum 2.5)
Repetition Count: +1
Interval: Accelerated progression
```

**Interval Calculation:**

- 1st repetition: 4 days
- 2nd repetition: 10 days
- 3rd+ repetition: Previous interval × Easiness Factor × 1.3

**Example:**

- Before: EF=2.1, Count=2, Interval=10 days
- After: EF=2.25, Count=3, Interval=27 days (10 × 2.1 × 1.3)

## Review Session Logic

### Queue Management

The system uses two queues to manage reviews:

1. **Main Queue**: Words scheduled for today's review
2. **Again Queue**: Words that were assessed as "Again" during the current session

### Priority System

1. **Again Queue First**: Always show "Again" words before continuing with main queue
2. **Sequential Main**: Process main queue words in order
3. **Re-queue Management**: "Again" words are immediately added to again queue

### Session Statistics

- **Progress**: (Completed Words / Total Words) × 100%
- **Remaining**: Total Words - Completed + Again Queue Size
- **Completion**: Session ends when both queues are empty

## Mathematical Examples

### Learning Progression for a Typical Word

**Day 1** - New word (Good assessment):

```
Initial: EF=2.5, Count=0, Interval=0
Result: EF=2.5, Count=1, Interval=1 → Next review: Day 2
```

**Day 2** - First review (Good assessment):

```
Before: EF=2.5, Count=1, Interval=1
Result: EF=2.5, Count=2, Interval=6 → Next review: Day 8
```

**Day 8** - Second review (Good assessment):

```
Before: EF=2.5, Count=2, Interval=6
Result: EF=2.5, Count=3, Interval=15 → Next review: Day 23
```

**Day 23** - Third review (Easy assessment):

```
Before: EF=2.5, Count=3, Interval=15
Result: EF=2.5, Count=4, Interval=49 → Next review: Day 72
```

### Difficulty Word Scenario

**Day 1** - New word (Hard assessment):

```
Initial: EF=2.5, Count=0, Interval=0
Result: EF=2.35, Count=1, Interval=1 → Next review: Day 2
```

**Day 2** - First review (Again assessment):

```
Before: EF=2.35, Count=1, Interval=1
Result: EF=2.15, Count=0, Interval=0 → Immediate re-review
```

**Same Day** - Re-review (Good assessment):

```
Before: EF=2.15, Count=0, Interval=0
Result: EF=2.15, Count=1, Interval=1 → Next review: Day 3
```

## Benefits of This System

### Adaptive Learning

- Words you find easy are spaced out quickly
- Difficult words stay in frequent rotation
- Individual learning patterns are accommodated

### Efficiency

- Optimal review intervals minimize wasted time
- Focus on words that need attention
- Long-term retention is maximized

### Progress Tracking

- Clear metrics show learning progress
- Easiness factors indicate word difficulty
- Review counts show familiarity levels

## Implementation Details

### Database Storage

Each word stores SRS parameters:

```sql
interval_days INTEGER DEFAULT 0,
repetition_count INTEGER DEFAULT 0,
easiness_factor DECIMAL(3,2) DEFAULT 2.5,
next_review_date DATE DEFAULT CURRENT_DATE,
last_reviewed_at TIMESTAMP
```

### Review Query

Words are selected for review using:

```sql
SELECT * FROM words
WHERE user_id = $1
AND next_review_date <= CURRENT_DATE
ORDER BY next_review_date ASC
```

### Update Process

After each assessment, the system:

1. Calculates new SRS parameters using the algorithm
2. Updates the word record in the database
3. Sets the next review date
4. Records the current timestamp as `last_reviewed_at`

## Customization Options

### Easiness Factor Bounds

- Minimum: 1.3 (prevents intervals from becoming too short)
- Maximum: 2.5 (prevents intervals from becoming too long)

### Initial Intervals

- First review: 1-4 days (depending on initial assessment)
- Second review: 6-10 days (depending on performance)
- Subsequent: Calculated using easiness factor

### Assessment Penalties/Bonuses

- Again: -0.2 easiness factor
- Hard: -0.15 easiness factor
- Good: No change
- Easy: +0.15 easiness factor

This system ensures that vocabulary learning is both efficient and effective, adapting to individual learning patterns while maintaining optimal review schedules for long-term retention.
