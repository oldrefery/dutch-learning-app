# **Detailed Project Plan (Phased Approach)**

This document outlines the development of the Dutch Learning App in distinct phases, starting with a core MVP and progressively adding features.

### **Phase 0: Foundation & Architecture (The "Setup" Phase)**

**Goal:** Prepare the entire development environment and architectural foundation.

* **Project Setup:**  
  * Initialize a new Expo (React Native) project with TypeScript.  
  * Set up expo-router for file-based navigation.  
  * Configure ESLint, Prettier, and Husky for code quality and pre-commit hooks.  
* **Supabase Integration:**  
  * Set up a new Supabase project.  
  * Define the database schema (as per DATABASE\_SCHEMA.md).  
  * Set up Row Level Security (RLS) rules: users can only access their own data.  
  * Manually create a "dev" user in Supabase and get their user\_id.  
* **Environment:**  
  * Create a .env file for storing Supabase keys and the DEV\_USER\_ID.  
  * Set up a Supabase client in the app to connect to the backend.  
* **Component Structure:**  
  * Create the basic directory structure as recommended by Expo (app, components, constants, hooks, etc.).

### **Phase 1: Core MVP (The "It Works" Phase)**

**Goal:** Implement the primary user loop: add a word, see it, and review it.

* **AI Integration (Secure Backend):**  
  * Create a Supabase Edge Function to securely call the Gemini API.  
  * The function should accept a word, query the AI, and return structured JSON.  
* **Screens & Navigation:**  
  * **Home/Collections Screen:** Displays a list of word collections. Initially, it can be a single default collection.  
  * **Collection Detail Screen:** Shows all the words within a selected collection.  
  * **Add Word Screen:** A simple input field and a button to trigger the AI analysis flow.  
  * **Review Session Screen:** A flashcard interface for reviewing words.  
* **Core Functionality:**  
  * **Add Word Flow:** Implement the UI to call the Edge Function, display the AI's response, and save the final word data to the Supabase database.  
  * **Review Logic:**  
    * Fetch words due for review (next\_review\_date is today or in the past).  
    * Implement the Spaced Repetition System (SRS) logic based on user's self-assessment ("Again", "Hard", "Good", "Easy").  
    * Implement the "relearning" queue for cards marked "Again" within the same session.  
  * **Display:**  
    * On the card, show only the 1-3 most common translations by default, with an option to expand and see all.

### **Phase 2: Enhancing the Learning Experience**

**Goal:** Add more varied and engaging ways to practice vocabulary.

* **New Practice Modes:**  
  * **Typing Quiz:** Show the translation and ask the user to type the Dutch word.  
  * **Listening Quiz:** Play the audio and ask the user to type what they hear.  
* **UI/UX Improvements:**  
  * Add animations and transitions using Reanimated or Skia to make the UI feel more fluid.  
  * Implement loading states and skeletons for a better perceived performance.  
* **Word Management:**  
  * Allow users to edit or delete words from their collections.  
  * Allow creating and naming multiple collections.

### **Phase 3: Gamification & Motivation**

**Goal:** Introduce elements that encourage daily use and long-term engagement.

* **Core Gamification:**  
  * **Streaks:** Track consecutive days of study.  
  * **Daily Goals:** Allow the user to set a goal (e.g., "review 20 words per day").  
* **Visual Feedback:**  
  * Create a simple dashboard or stats screen showing basic progress (total words learned, streak count, etc.).  
  * Implement achievements/badges for milestones (e.g., "First 100 words learned").

### **Phase 4: Scaling & User Management**

**Goal:** Prepare the app for multiple users and add advanced features.

* **Full Authentication:**  
  * Implement screens for email/password signup and login using Supabase Auth.  
  * Replace the hardcoded DEV\_USER\_ID with the actual authenticated user's ID.  
* **Advanced Settings:**  
  * Create a settings screen where users can securely enter and save their own AI API key.  
* **Content:**  
  * Develop a system for creating and distributing pre-made word packs (e.g., "Top 100 Dutch Verbs").  
* **OCR Integration:**  
  * Implement a feature to take a photo or select an image.  
  * Use a local or cloud-based OCR library to extract text.  
  * Allow the user to tap on extracted words to add them to their collections via the AI flow.

### **Phase 5 & 6: Future Vision (The "Wow" Features)**

**Goal:** Implement unique features that set the app apart from competitors.

* **Browser Extension:** A companion extension to add words directly from websites.  
* **AI-Powered Error Analysis:** Provide specific grammatical feedback on user mistakes.  
* **"Word in the Wild":** Show real-world examples of learned words from recent news or articles.  
* **Conversational AI Tutor:** A chat interface to practice using learned vocabulary in realistic dialogues.