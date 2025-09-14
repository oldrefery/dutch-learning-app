# **Detailed Task Breakdown**

This document breaks down the project plan into small, actionable tasks, each estimated to take 2-4 hours.

### **Phase 0: Foundation & Architecture**

**Total Estimated Time: \~12-16 hours**

1. **Expo Project Initialization (2-3 hours)**
   - npx create-expo-app \--template with Tabs (TypeScript).
   - Clean up boilerplate code.
   - Confirm basic navigation with expo-router works.
2. **Code Quality Setup (2-4 hours)**
   - npm install eslint prettier husky lint-staged \--save-dev.
   - Configure ESLint with recommended rules for React/React Native/TypeScript.
   - Configure Prettier.
   - Set up Husky pre-commit hook to run linter and formatter.
3. **Supabase Project Setup (2-3 hours)**
   - Create a new project on the Supabase dashboard.
   - Use the SQL editor to run the script from DATABASE_SCHEMA.md to create tables.
   - Enable Row Level Security (RLS) on all user-specific tables.
4. **Supabase RLS & Dev User (2-3 hours)**
   - Write and apply RLS policies (e.g., (auth.uid() \= user_id)).
   - Go to Authentication \-\> Users and manually create a "dev" user.
   - Copy the user's uid.
5. **App-Supabase Connection (2-3 hours)**
   - Create .env file and add Supabase URL, anon key, and the DEV_USER_ID.
   - Create a Supabase client singleton instance (src/lib/supabase.ts).
   - Create a simple test component to fetch data from a public table to verify the connection.

### **Phase 1: Core MVP**

**Total Estimated Time: \~20-28 hours**

1. **Supabase Edge Function for AI (3-4 hours)**
   - Initialize Supabase functions locally: supabase functions new gemini-handler.
   - Write the Deno/TypeScript code for the function. It should receive { word: "..." }.
   - Securely store the Gemini API key using supabase secrets set.
   - Deploy and test the function using the Supabase dashboard.
2. **State Management & Data Types (2-3 hours)**
   - Install Zustand.
   - Define TypeScript types for Word, Collection, and ReviewSession.
   - Set up a basic store for managing the app's global state (e.g., current user's collections).
3. **Home & Collection Screens UI (3-4 hours)**
   - Build the component for displaying a list of collections.
   - Build the component for displaying a list of words within a collection.
   - Hook up these components to fetch data from Supabase.
4. **"Add Word" Screen UI & Logic (3-4 hours)**
   - Create the UI with a text input and a button.
   - Implement the logic to call the gemini-handler Edge Function.
   - Create a loading state while waiting for the AI response.
5. **"Confirm Word" Component (3-4 hours)**
   - Build the UI to display the structured data received from the AI.
   - Allow fields to be editable.
   - Implement the "Save" button logic to write the final word data to the words table in Supabase.
6. **Review Session \- Card UI (2-4 hours)**
   - Build the flashcard component (front and back views).
   - Add animations for flipping the card using Reanimated.
   - Add the four self-assessment buttons ("Again", "Hard", "Good", "Easy").
7. **Review Session \- SRS Logic (4-6 hours)**
   - Write the core SRS algorithm in a separate hook or utility function (useSRS.ts).
   - Implement logic to fetch due cards from Supabase for a new session.
   - Connect the UI buttons to the SRS logic to calculate the next review date.
   - Implement the "relearning" queue for cards marked "Again".
   - On session completion, batch update the changed words in Supabase.

### **Phase 2: Enhancing the Learning Experience**

**Total Estimated Time: \~10-16 hours**

1. **Typing Quiz Component (4-6 hours)**
   - Design the UI: show a prompt (e.g., the English translation) and a text input.
   - Implement logic to check if the user's typed answer is correct.
   - Provide visual feedback for correct/incorrect answers.
2. **Listening Quiz Component (4-6 hours)**
   - Implement logic to fetch and play the tts_url for a word.
   - Reuse the typing input component for the user's answer.
3. **Collection Management (2-4 hours)**
   - Implement a modal or screen for creating a new collection.
   - Add "edit" and "delete" functionality to words and collections (with confirmation dialogs).
