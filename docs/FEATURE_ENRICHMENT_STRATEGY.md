# **Strategy for Advanced Vocabulary Features (v2 \- AI Enhanced)**

This document outlines an AI-first strategy for implementing advanced vocabulary features. This approach provides more flexibility and power than relying on multiple traditional APIs.

### **Core Idea: AI-Powered Enrichment**

The flow for adding a new word will be centered around a Generative AI model (e.g., Gemini).

**New User Flow:**

1. User inputs a Dutch word in any form (e.g., "gekocht" or "koop").  
2. The app sends a request to a Gen AI model.  
3. The AI analyzes the word and returns a structured JSON object with its infinitive form (lemma), part of speech, translations, and example sentences.  
4. The app uses this data to pre-fill the "Add Word" form. The user can review/edit.  
5. Optionally, the app can then use the word's translation to fetch or generate an image.

### **1\. Grammatical Analysis & Lemmatization (AI-Powered)**

**Requirement:** Automatically identify the base form (infinitive/lemma) of a word, its type, and properties (e.g., irregular verb).

**Solution:** Use a Gen AI model.

* **Prompt Example:**  
  For the Dutch word "gekocht", provide a JSON object with the following keys:  
  \- "lemma": The infinitive or base form.  
  \- "part\_of\_speech": e.g., "verb", "noun".  
  \- "type": e.g., "irregular", "reflexive".  
  \- "translation\_en": The primary English translation of the lemma.

* **Expected AI Response:**  
  {  
    "lemma": "kopen",  
    "part\_of\_speech": "verb",  
    "type": "irregular",  
    "translation\_en": "to buy"  
  }

This single API call solves the most complex grammatical challenge.

### **2\. Multiple Translations & Architecture**

**Requirement:** English translation is mandatory. A secondary language (like Russian) is optional.

**Architecture:** The database will be structured to support this from the start. The primary English translation will be a dedicated field for easy access, while other translations will be stored in a flexible jsonb field.

### **3\. OCR (Photo-to-Word) Integration**

**Requirement:** Allow users to add words by photographing text. If a word already exists, its review interval should be shortened.

**Solution:**

1. **Text Recognition:** Use an on-device OCR library (e.g., via an Expo module) or a cloud Vision AI API to extract text from an image.  
2. **Word Selection:** The user can tap on recognized words.  
3. **Enrichment & Adding:** For each tapped word, the app follows the AI-powered flow described in section 1\.  
4. **SRS Logic:**  
   * **If the word is new:** Add it to the user's collection and create a new user\_progress record.  
   * **If the word already exists:** Find its user\_progress record and update it. **Specifically, set next\_review\_date to today's date** to force an immediate review. This is more effective than just reducing the interval.

### **4\. Audio Pronunciation & Image Association**

* **Audio:** The strategy remains the same. Forvo is the best source for authentic human pronunciation. A cloud TTS service is a great fallback.  
* **Images:**  
  * **Option A (Search):** Use an API like Unsplash with the English translation as the search query.  
  * **Option B (Generate):** Use an image generation AI (like Imagen) to create a custom visual. This offers more creative control.

The app can be configured to use one or both methods.