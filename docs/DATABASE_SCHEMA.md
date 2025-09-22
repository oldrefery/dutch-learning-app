# **Supabase Database Schema**

This schema is designed for a PostgreSQL database managed by Supabase.

### **Table: users**

Stores public user profile information. Linked to Supabase's built-in auth.users table.

| Column     | Type        | Constraints                        | Description                                      |
| :--------- | :---------- | :--------------------------------- | :----------------------------------------------- |
| id         | uuid        | PRIMARY KEY, REFERENCES auth.users | The user's unique identifier from Supabase Auth. |
| username   | text        | UNIQUE                             | A public username for social features.           |
| created_at | timestamptz | NOT NULL, DEFAULT now()            | Timestamp of when the user profile was created.  |

### **Table: collections**

Stores user-created collections or decks of words.

| Column        | Type        | Constraints                             | Description                                      |
| :------------ | :---------- | :-------------------------------------- | :----------------------------------------------- |
| collection_id | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier for the collection.            |
| user_id       | uuid        | NOT NULL, REFERENCES users(id)          | The user who owns this collection.               |
| name          | text        | NOT NULL                                | The name of the collection (e.g., "Food Verbs"). |
| created_at    | timestamptz | NOT NULL, DEFAULT now()                 | Timestamp of when the collection was created.    |

### **Table: words**

The core table, storing each individual word or phrase the user is learning. This table contains all the information for the flashcards and the SRS algorithm.

| Column           | Type        | Constraints                             | Description                                                                                        |
| :--------------- | :---------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------- |
| word_id          | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier for the word entry.                                                              |
| user_id          | uuid        | NOT NULL, REFERENCES users(id)          | The user who owns this word.                                                                       |
| collection_id    | uuid        | REFERENCES collections(collection_id)   | The collection this word belongs to (can be NULL).                                                 |
| dutch_lemma      | text        | NOT NULL                                | The base form/infinitive of the word (e.g., "kopen").                                              |
| dutch_original   | text        |                                         | The word as the user originally entered it (e.g., "gekocht").                                      |
| part_of_speech   | text        |                                         | e.g., "verb", "noun", "adjective".                                                                 |
| is_irregular     | boolean     | DEFAULT false                           | Specifically for verbs, indicates if it's irregular.                                               |
| translations     | jsonb       | NOT NULL                                | A JSON object storing translations, e.g., {"en": \["to buy", "purchase"\], "ru": \["покупать"\]}.  |
| examples         | jsonb\[\]   |                                         | An array of JSON objects for example sentences, e.g., \[{"nl": "...", "en": "...", "ru": "..."}\]. |
| image_url        | text        |                                         | URL to an associated image (from an image generation service or stock photo API).                  |
| tts_url          | text        | NOT NULL                                | URL to the Text-to-Speech audio file for the Dutch lemma.                                          |
| **SRS Fields**   |             |                                         | **Fields for the Spaced Repetition Algorithm**                                                     |
| interval_days    | integer     | NOT NULL, DEFAULT 1                     | The current interval in days until the next review.                                                |
| repetition_count | integer     | NOT NULL, DEFAULT 0                     | The number of times the word has been successfully recalled in a row.                              |
| easiness_factor  | float       | NOT NULL, DEFAULT 2.5                   | A factor representing how "easy" the word is for the user. Used to calculate the next interval.    |
| next_review_date | date        | NOT NULL, DEFAULT now()                 | The specific date when this word should be reviewed again.                                         |
| last_reviewed_at | timestamptz |                                         | Timestamp of the last review.                                                                      |
| analysis_notes   | text        |                                         | User notes from word analysis for learning context and personal observations.                      |
| created_at       | timestamptz | NOT NULL, DEFAULT now()                 | Timestamp of when the word was first added.                                                        |
