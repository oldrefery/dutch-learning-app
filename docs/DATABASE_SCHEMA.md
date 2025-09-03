# **Supabase Database Schema**

This schema is designed for a PostgreSQL database managed by Supabase.

### **Table: users**

Stores public user profile information. Linked to Supabase's built-in auth.users table.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | uuid | PRIMARY KEY, REFERENCES auth.users | The user's unique identifier from Supabase Auth. |
| username | text | UNIQUE | A public username for social features. |
| created\_at | timestamptz | NOT NULL, DEFAULT now() | Timestamp of when the user profile was created. |

### **Table: collections**

Stores user-created collections or decks of words.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| collection\_id | uuid | PRIMARY KEY, DEFAULT uuid\_generate\_v4() | Unique identifier for the collection. |
| user\_id | uuid | NOT NULL, REFERENCES users(id) | The user who owns this collection. |
| name | text | NOT NULL | The name of the collection (e.g., "Food Verbs"). |
| created\_at | timestamptz | NOT NULL, DEFAULT now() | Timestamp of when the collection was created. |

### **Table: words**

The core table, storing each individual word or phrase the user is learning. This table contains all the information for the flashcards and the SRS algorithm.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| word\_id | uuid | PRIMARY KEY, DEFAULT uuid\_generate\_v4() | Unique identifier for the word entry. |
| user\_id | uuid | NOT NULL, REFERENCES users(id) | The user who owns this word. |
| collection\_id | uuid | REFERENCES collections(collection\_id) | The collection this word belongs to (can be NULL). |
| dutch\_lemma | text | NOT NULL | The base form/infinitive of the word (e.g., "kopen"). |
| dutch\_original | text |  | The word as the user originally entered it (e.g., "gekocht"). |
| part\_of\_speech | text |  | e.g., "verb", "noun", "adjective". |
| is\_irregular | boolean | DEFAULT false | Specifically for verbs, indicates if it's irregular. |
| translations | jsonb | NOT NULL | A JSON object storing translations, e.g., {"en": \["to buy", "purchase"\], "ru": \["покупать"\]}. |
| examples | jsonb\[\] |  | An array of JSON objects for example sentences, e.g., \[{"nl": "...", "en": "...", "ru": "..."}\]. |
| image\_url | text |  | URL to an associated image (from an image generation service or stock photo API). |
| tts\_url | text | NOT NULL | URL to the Text-to-Speech audio file for the Dutch lemma. |
| **SRS Fields** |  |  | **Fields for the Spaced Repetition Algorithm** |
| interval\_days | integer | NOT NULL, DEFAULT 1 | The current interval in days until the next review. |
| repetition\_count | integer | NOT NULL, DEFAULT 0 | The number of times the word has been successfully recalled in a row. |
| easiness\_factor | float | NOT NULL, DEFAULT 2.5 | A factor representing how "easy" the word is for the user. Used to calculate the next interval. |
| next\_review\_date | date | NOT NULL, DEFAULT now() | The specific date when this word should be reviewed again. |
| last\_reviewed\_at | timestamptz |  | Timestamp of the last review. |
| created\_at | timestamptz | NOT NULL, DEFAULT now() | Timestamp of when the word was first added. |

