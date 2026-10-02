// Generated from local migrations through 20261002130000_add_analysis_cefr_estimate.sql.
// Supabase Postgres Meta 0.99.0; source and options: target-schema.json.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      collections: {
        Row: {
          collection_id: string
          created_at: string
          is_shared: boolean | null
          name: string
          share_token: string | null
          shared_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          collection_id?: string
          created_at?: string
          is_shared?: boolean | null
          name: string
          share_token?: string | null
          shared_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          is_shared?: boolean | null
          name?: string
          share_token?: string | null
          shared_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'collections_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      dictionary_cefr_assessments: {
        Row: {
          assessed_at: string
          assessment_id: string
          cefr_level: string | null
          confidence: number | null
          created_at: string
          entry_id: string
          input_sha256: string
          locked: boolean
          method: string
          method_version: string
          source_id: string | null
          status: string
          supersedes_assessment_id: string | null
        }
        Insert: {
          assessed_at?: string
          assessment_id?: string
          cefr_level?: string | null
          confidence?: number | null
          created_at?: string
          entry_id: string
          input_sha256: string
          locked?: boolean
          method: string
          method_version: string
          source_id?: string | null
          status?: string
          supersedes_assessment_id?: string | null
        }
        Update: {
          assessed_at?: string
          assessment_id?: string
          cefr_level?: string | null
          confidence?: number | null
          created_at?: string
          entry_id?: string
          input_sha256?: string
          locked?: boolean
          method?: string
          method_version?: string
          source_id?: string | null
          status?: string
          supersedes_assessment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'dictionary_cefr_assessments_entry'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'dictionary_entries'
            referencedColumns: ['entry_id']
          },
          {
            foreignKeyName: 'dictionary_cefr_assessments_entry'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'readable_dictionary_content'
            referencedColumns: ['entry_id']
          },
          {
            foreignKeyName: 'dictionary_cefr_assessments_supersedes'
            columns: ['entry_id', 'supersedes_assessment_id']
            isOneToOne: false
            referencedRelation: 'dictionary_cefr_assessments'
            referencedColumns: ['entry_id', 'assessment_id']
          },
        ]
      }
      dictionary_cefr_heads: {
        Row: {
          assessment_id: string
          entry_id: string
          input_sha256: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          entry_id: string
          input_sha256: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          entry_id?: string
          input_sha256?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dictionary_cefr_heads_assessment'
            columns: ['entry_id', 'input_sha256', 'assessment_id']
            isOneToOne: false
            referencedRelation: 'dictionary_cefr_assessments'
            referencedColumns: ['entry_id', 'input_sha256', 'assessment_id']
          },
        ]
      }
      dictionary_entries: {
        Row: {
          article: string | null
          created_at: string
          entry_id: string
          language_code: string
          lemma: string
          part_of_speech: string | null
          sense_key: string
          state: string
          updated_at: string
        }
        Insert: {
          article?: string | null
          created_at?: string
          entry_id?: string
          language_code: string
          lemma: string
          part_of_speech?: string | null
          sense_key: string
          state?: string
          updated_at?: string
        }
        Update: {
          article?: string | null
          created_at?: string
          entry_id?: string
          language_code?: string
          lemma?: string
          part_of_speech?: string | null
          sense_key?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      dictionary_entry_heads: {
        Row: {
          entry_id: string
          revision_id: string
          updated_at: string
        }
        Insert: {
          entry_id: string
          revision_id: string
          updated_at?: string
        }
        Update: {
          entry_id?: string
          revision_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dictionary_entry_heads_revision'
            columns: ['entry_id', 'revision_id']
            isOneToOne: false
            referencedRelation: 'dictionary_revisions'
            referencedColumns: ['entry_id', 'revision_id']
          },
        ]
      }
      dictionary_revisions: {
        Row: {
          cefr_input_sha256: string
          content: Json
          content_sha256: string
          created_at: string
          entry_id: string
          published_at: string | null
          review_status: string
          reviewed_at: string | null
          revision_id: string
          revision_no: number
          schema_version: number
          source_id: string
        }
        Insert: {
          cefr_input_sha256: string
          content: Json
          content_sha256: string
          created_at?: string
          entry_id: string
          published_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          revision_id?: string
          revision_no: number
          schema_version?: number
          source_id: string
        }
        Update: {
          cefr_input_sha256?: string
          content?: Json
          content_sha256?: string
          created_at?: string
          entry_id?: string
          published_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          revision_id?: string
          revision_no?: number
          schema_version?: number
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dictionary_revisions_entry'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'dictionary_entries'
            referencedColumns: ['entry_id']
          },
          {
            foreignKeyName: 'dictionary_revisions_entry'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'readable_dictionary_content'
            referencedColumns: ['entry_id']
          },
        ]
      }
      edge_function_rate_limits: {
        Row: {
          capability: string
          request_count: number
          updated_at: string
          user_id: string
          window_started_at: string
        }
        Insert: {
          capability: string
          request_count?: number
          updated_at?: string
          user_id: string
          window_started_at?: string
        }
        Update: {
          capability?: string
          request_count?: number
          updated_at?: string
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      learning_progress_cutovers: {
        Row: {
          cutover_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          cutover_at: string
          user_id: string
          word_id: string
        }
        Update: {
          cutover_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learning_progress_cutovers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_progress_cutovers_word_id_fkey'
            columns: ['word_id']
            isOneToOne: true
            referencedRelation: 'words'
            referencedColumns: ['word_id']
          },
        ]
      }
      learning_resets: {
        Row: {
          created_at: string
          reset_at: string
          reset_id: string
          review_date: string
          user_id: string
          word_id: string
        }
        Insert: {
          created_at?: string
          reset_at: string
          reset_id: string
          review_date: string
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: string
          reset_at?: string
          reset_id?: string
          review_date?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learning_resets_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_resets_word_id_fkey'
            columns: ['word_id']
            isOneToOne: false
            referencedRelation: 'words'
            referencedColumns: ['word_id']
          },
        ]
      }
      official_content_pack_versions: {
        Row: {
          cefr_level: string
          content_sha256: string
          created_at: string
          description: string
          display_order: number
          entry_count: number
          manifest: Json
          pack_id: string
          published_at: string | null
          review_status: string
          reviewed_at: string | null
          title: string
          version: string
        }
        Insert: {
          cefr_level: string
          content_sha256: string
          created_at?: string
          description: string
          display_order: number
          entry_count: number
          manifest: Json
          pack_id: string
          published_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          title: string
          version: string
        }
        Update: {
          cefr_level?: string
          content_sha256?: string
          created_at?: string
          description?: string
          display_order?: number
          entry_count?: number
          manifest?: Json
          pack_id?: string
          published_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          title?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: 'official_content_pack_versions_pack'
            columns: ['pack_id']
            isOneToOne: false
            referencedRelation: 'official_content_packs'
            referencedColumns: ['pack_id']
          },
        ]
      }
      official_content_packs: {
        Row: {
          cefr_level: string
          created_at: string
          current_version: string | null
          description: string
          display_order: number
          entry_count: number
          pack_id: string
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          cefr_level: string
          created_at?: string
          current_version?: string | null
          description: string
          display_order?: number
          entry_count: number
          pack_id: string
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          cefr_level?: string
          created_at?: string
          current_version?: string | null
          description?: string
          display_order?: number
          entry_count?: number
          pack_id?: string
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'official_content_packs_current_version'
            columns: ['pack_id', 'current_version']
            isOneToOne: false
            referencedRelation: 'official_content_pack_versions'
            referencedColumns: ['pack_id', 'version']
          },
        ]
      }
      pre_approved_emails: {
        Row: {
          access_level: string
          created_at: string
          email: string
          id: string
          updated_at: string | null
        }
        Insert: {
          access_level?: string
          created_at?: string
          email: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          access_level?: string
          created_at?: string
          email?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      review_assessment_corrections: {
        Row: {
          assessment: string
          correction_id: string
          created_at: string
          event_id: string
          expected_revision: number
          next_easiness_factor: number
          next_interval_days: number
          next_repetition_count: number
          revision: number
          user_id: string
          word_id: string
        }
        Insert: {
          assessment: string
          correction_id: string
          created_at?: string
          event_id: string
          expected_revision: number
          next_easiness_factor: number
          next_interval_days: number
          next_repetition_count: number
          revision: number
          user_id: string
          word_id: string
        }
        Update: {
          assessment?: string
          correction_id?: string
          created_at?: string
          event_id?: string
          expected_revision?: number
          next_easiness_factor?: number
          next_interval_days?: number
          next_repetition_count?: number
          revision?: number
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'review_assessment_corrections_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'review_progress_checkpoints'
            referencedColumns: ['event_id']
          },
          {
            foreignKeyName: 'review_assessment_corrections_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'review_assessment_corrections_word_id_fkey'
            columns: ['word_id']
            isOneToOne: false
            referencedRelation: 'words'
            referencedColumns: ['word_id']
          },
        ]
      }
      review_events: {
        Row: {
          answered_correctly: boolean | null
          assessment: string
          created_at: string
          event_id: string
          next_easiness_factor: number
          next_interval_days: number
          previous_easiness_factor: number
          previous_interval_days: number
          response_time_ms: number | null
          review_date: string | null
          review_mode: string
          reviewed_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          answered_correctly?: boolean | null
          assessment: string
          created_at?: string
          event_id: string
          next_easiness_factor: number
          next_interval_days: number
          previous_easiness_factor: number
          previous_interval_days: number
          response_time_ms?: number | null
          review_date?: string | null
          review_mode: string
          reviewed_at: string
          user_id: string
          word_id: string
        }
        Update: {
          answered_correctly?: boolean | null
          assessment?: string
          created_at?: string
          event_id?: string
          next_easiness_factor?: number
          next_interval_days?: number
          previous_easiness_factor?: number
          previous_interval_days?: number
          response_time_ms?: number | null
          review_date?: string | null
          review_mode?: string
          reviewed_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'review_events_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'review_events_word_id_fkey'
            columns: ['word_id']
            isOneToOne: false
            referencedRelation: 'words'
            referencedColumns: ['word_id']
          },
        ]
      }
      review_progress_checkpoints: {
        Row: {
          event_id: string
          last_reviewed_at: string
          previous_easiness_factor: number
          previous_interval_days: number
          previous_repetition_count: number
          review_base_date: string
          user_id: string
          word_id: string
        }
        Insert: {
          event_id: string
          last_reviewed_at: string
          previous_easiness_factor: number
          previous_interval_days: number
          previous_repetition_count: number
          review_base_date: string
          user_id: string
          word_id: string
        }
        Update: {
          event_id?: string
          last_reviewed_at?: string
          previous_easiness_factor?: number
          previous_interval_days?: number
          previous_repetition_count?: number
          review_base_date?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'review_progress_checkpoints_event_id_fkey'
            columns: ['event_id']
            isOneToOne: true
            referencedRelation: 'effective_review_events'
            referencedColumns: ['event_id']
          },
          {
            foreignKeyName: 'review_progress_checkpoints_event_id_fkey'
            columns: ['event_id']
            isOneToOne: true
            referencedRelation: 'review_events'
            referencedColumns: ['event_id']
          },
          {
            foreignKeyName: 'review_progress_checkpoints_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'review_progress_checkpoints_word_id_fkey'
            columns: ['word_id']
            isOneToOne: false
            referencedRelation: 'words'
            referencedColumns: ['word_id']
          },
        ]
      }
      review_progress_heads: {
        Row: {
          event_id: string
          user_id: string
          word_id: string
        }
        Insert: {
          event_id: string
          user_id: string
          word_id: string
        }
        Update: {
          event_id?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'review_progress_heads_event_id_fkey'
            columns: ['event_id']
            isOneToOne: true
            referencedRelation: 'review_progress_checkpoints'
            referencedColumns: ['event_id']
          },
          {
            foreignKeyName: 'review_progress_heads_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'review_progress_heads_word_id_fkey'
            columns: ['word_id']
            isOneToOne: true
            referencedRelation: 'words'
            referencedColumns: ['word_id']
          },
        ]
      }
      user_access_levels: {
        Row: {
          access_level: string
          created_at: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_level: string
          created_at?: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          created_at: string
          deleted_at: string | null
          last_reviewed_at: string | null
          progress_id: string
          reviewed_count: number
          status: string
          updated_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          last_reviewed_at?: string | null
          progress_id?: string
          reviewed_count?: number
          status: string
          updated_at?: string
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          last_reviewed_at?: string | null
          progress_id?: string
          reviewed_count?: number
          status?: string
          updated_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_progress_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_progress_word_id_fkey'
            columns: ['word_id']
            isOneToOne: false
            referencedRelation: 'words'
            referencedColumns: ['word_id']
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      word_analysis_cache: {
        Row: {
          analysis_notes: string | null
          antonyms: Json | null
          article: string | null
          cache_id: string
          cache_ttl_hours: number
          cache_version: number
          cefr_estimate: Json | null
          conjugation: Json | null
          created_at: string
          dictionary_entry_id: string | null
          dictionary_revision_id: string | null
          dutch_lemma: string
          dutch_original: string
          examples: Json[] | null
          expression_type: string | null
          image_url: string | null
          is_expression: boolean | null
          is_irregular: boolean | null
          is_reflexive: boolean | null
          is_separable: boolean | null
          last_used_at: string
          part_of_speech: string | null
          plural: string | null
          prefix_part: string | null
          preposition: string | null
          register: string | null
          root_verb: string | null
          synonyms: Json | null
          translations: Json
          tts_url: string | null
          updated_at: string
          usage_count: number
          usage_notes: Json | null
        }
        Insert: {
          analysis_notes?: string | null
          antonyms?: Json | null
          article?: string | null
          cache_id?: string
          cache_ttl_hours?: number
          cache_version?: number
          cefr_estimate?: Json | null
          conjugation?: Json | null
          created_at?: string
          dictionary_entry_id?: string | null
          dictionary_revision_id?: string | null
          dutch_lemma: string
          dutch_original: string
          examples?: Json[] | null
          expression_type?: string | null
          image_url?: string | null
          is_expression?: boolean | null
          is_irregular?: boolean | null
          is_reflexive?: boolean | null
          is_separable?: boolean | null
          last_used_at?: string
          part_of_speech?: string | null
          plural?: string | null
          prefix_part?: string | null
          preposition?: string | null
          register?: string | null
          root_verb?: string | null
          synonyms?: Json | null
          translations: Json
          tts_url?: string | null
          updated_at?: string
          usage_count?: number
          usage_notes?: Json | null
        }
        Update: {
          analysis_notes?: string | null
          antonyms?: Json | null
          article?: string | null
          cache_id?: string
          cache_ttl_hours?: number
          cache_version?: number
          cefr_estimate?: Json | null
          conjugation?: Json | null
          created_at?: string
          dictionary_entry_id?: string | null
          dictionary_revision_id?: string | null
          dutch_lemma?: string
          dutch_original?: string
          examples?: Json[] | null
          expression_type?: string | null
          image_url?: string | null
          is_expression?: boolean | null
          is_irregular?: boolean | null
          is_reflexive?: boolean | null
          is_separable?: boolean | null
          last_used_at?: string
          part_of_speech?: string | null
          plural?: string | null
          prefix_part?: string | null
          preposition?: string | null
          register?: string | null
          root_verb?: string | null
          synonyms?: Json | null
          translations?: Json
          tts_url?: string | null
          updated_at?: string
          usage_count?: number
          usage_notes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'word_analysis_cache_dictionary_revision'
            columns: ['dictionary_entry_id', 'dictionary_revision_id']
            isOneToOne: false
            referencedRelation: 'dictionary_revisions'
            referencedColumns: ['entry_id', 'revision_id']
          },
        ]
      }
      word_content_state: {
        Row: {
          content_version: number
          fallback_content: Json | null
          overrides: Json
          updated_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          content_version?: number
          fallback_content?: Json | null
          overrides?: Json
          updated_at?: string
          user_id: string
          word_id: string
        }
        Update: {
          content_version?: number
          fallback_content?: Json | null
          overrides?: Json
          updated_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'word_content_state_word_owner'
            columns: ['word_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'words'
            referencedColumns: ['word_id', 'user_id']
          },
        ]
      }
      words: {
        Row: {
          analysis_notes: string | null
          antonyms: string[]
          article: string | null
          collection_id: string | null
          conjugation: Json | null
          created_at: string
          deleted_at: string | null
          dictionary_entry_id: string | null
          dictionary_revision_id: string | null
          dutch_lemma: string
          dutch_original: string | null
          easiness_factor: number
          examples: Json[] | null
          expression_type: string | null
          image_url: string | null
          interval_days: number
          is_expression: boolean | null
          is_irregular: boolean | null
          is_reflexive: boolean | null
          is_separable: boolean | null
          last_reviewed_at: string | null
          next_review_date: string
          part_of_speech: string | null
          plural: string | null
          prefix_part: string | null
          preposition: string | null
          register: string | null
          repetition_count: number
          root_verb: string | null
          synonyms: string[]
          translations: Json
          tts_url: string
          updated_at: string | null
          usage_notes: Json | null
          user_id: string
          word_id: string
        }
        Insert: {
          analysis_notes?: string | null
          antonyms?: string[]
          article?: string | null
          collection_id?: string | null
          conjugation?: Json | null
          created_at?: string
          deleted_at?: string | null
          dictionary_entry_id?: string | null
          dictionary_revision_id?: string | null
          dutch_lemma: string
          dutch_original?: string | null
          easiness_factor?: number
          examples?: Json[] | null
          expression_type?: string | null
          image_url?: string | null
          interval_days?: number
          is_expression?: boolean | null
          is_irregular?: boolean | null
          is_reflexive?: boolean | null
          is_separable?: boolean | null
          last_reviewed_at?: string | null
          next_review_date?: string
          part_of_speech?: string | null
          plural?: string | null
          prefix_part?: string | null
          preposition?: string | null
          register?: string | null
          repetition_count?: number
          root_verb?: string | null
          synonyms?: string[]
          translations: Json
          tts_url: string
          updated_at?: string | null
          usage_notes?: Json | null
          user_id: string
          word_id?: string
        }
        Update: {
          analysis_notes?: string | null
          antonyms?: string[]
          article?: string | null
          collection_id?: string | null
          conjugation?: Json | null
          created_at?: string
          deleted_at?: string | null
          dictionary_entry_id?: string | null
          dictionary_revision_id?: string | null
          dutch_lemma?: string
          dutch_original?: string | null
          easiness_factor?: number
          examples?: Json[] | null
          expression_type?: string | null
          image_url?: string | null
          interval_days?: number
          is_expression?: boolean | null
          is_irregular?: boolean | null
          is_reflexive?: boolean | null
          is_separable?: boolean | null
          last_reviewed_at?: string | null
          next_review_date?: string
          part_of_speech?: string | null
          plural?: string | null
          prefix_part?: string | null
          preposition?: string | null
          register?: string | null
          repetition_count?: number
          root_verb?: string | null
          synonyms?: string[]
          translations?: Json
          tts_url?: string
          updated_at?: string | null
          usage_notes?: Json | null
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'words_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'words_dictionary_revision'
            columns: ['dictionary_entry_id', 'dictionary_revision_id']
            isOneToOne: false
            referencedRelation: 'dictionary_revisions'
            referencedColumns: ['entry_id', 'revision_id']
          },
          {
            foreignKeyName: 'words_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      effective_review_events: {
        Row: {
          answered_correctly: boolean | null
          assessment: string | null
          created_at: string | null
          event_id: string | null
          next_easiness_factor: number | null
          next_interval_days: number | null
          original_assessment: string | null
          previous_easiness_factor: number | null
          previous_interval_days: number | null
          response_time_ms: number | null
          review_date: string | null
          review_mode: string | null
          reviewed_at: string | null
          revision: number | null
          user_id: string | null
          word_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'review_events_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'review_events_word_id_fkey'
            columns: ['word_id']
            isOneToOne: false
            referencedRelation: 'words'
            referencedColumns: ['word_id']
          },
        ]
      }
      readable_dictionary_content: {
        Row: {
          article: string | null
          cefr_assessed_at: string | null
          cefr_confidence: number | null
          cefr_input_sha256: string | null
          cefr_level: string | null
          cefr_locked: boolean | null
          cefr_status: string | null
          content: Json | null
          content_sha256: string | null
          entry_id: string | null
          language_code: string | null
          lemma: string | null
          part_of_speech: string | null
          published_at: string | null
          revision_id: string | null
          revision_no: number | null
          schema_version: number | null
          sense_key: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_dictionary_content_command_v1: {
        Args: { p_command: Json }
        Returns: Json
      }
      apply_dictionary_import_intent_v1: {
        Args: { p_intent: Json }
        Returns: Json
      }
      calculate_review_progress: {
        Args: {
          p_assessment: string
          p_easiness: number
          p_interval: number
          p_repetitions: number
        }
        Returns: {
          easiness_factor: number
          interval_days: number
          repetition_count: number
        }[]
      }
      cancel_dictionary_import_v1: { Args: { p_request: Json }; Returns: Json }
      consume_edge_function_quota: {
        Args: {
          p_capability: string
          p_limit: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      correct_review_assessment: {
        Args: {
          p_assessment: string
          p_correction_id: string
          p_event_id: string
          p_expected_revision: number
          p_word_id: string
        }
        Returns: {
          accepted_revision: number
          correction_id: string
          easiness_factor: number
          effective_assessment: string
          effective_revision: number
          event_id: string
          interval_days: number
          last_reviewed_at: string
          next_review_date: string
          repetition_count: number
          word_id: string
        }[]
      }
      dictionary_content_capability_v1: { Args: never; Returns: Json }
      export_dictionary_collection_v1: {
        Args: { p_collection_id: string }
        Returns: Json
      }
      get_dictionary_content_changes_v1: {
        Args: { p_after?: number; p_limit?: number }
        Returns: Json
      }
      get_dictionary_effective_content_v1: {
        Args: { p_word_ids?: string[] }
        Returns: Json
      }
      get_official_dictionary_mapping_v1: {
        Args: { p_pack_id: string; p_version: string }
        Returns: Json
      }
      get_shared_dictionary_collection_v1: {
        Args: { p_share_token: string }
        Returns: Json
      }
      get_user_access_level: { Args: { user_uuid: string }; Returns: string }
      get_valid_cache_entry: {
        Args: { lemma: string }
        Returns: {
          analysis_notes: string
          antonyms: Json
          article: string
          cache_id: string
          conjugation: Json
          dutch_lemma: string
          dutch_original: string
          examples: Json[]
          expression_type: string
          image_url: string
          is_expression: boolean
          is_irregular: boolean
          is_reflexive: boolean
          is_separable: boolean
          part_of_speech: string
          plural: string
          prefix_part: string
          preposition: string
          root_verb: string
          synonyms: Json
          translations: Json
          tts_url: string
          usage_count: number
        }[]
      }
      get_web_collection_overviews_v1: {
        Args: { p_today: string }
        Returns: {
          collection_id: string
          created_at: string
          difficult_words: number
          due_words: number
          is_shared: boolean
          mastered_words: number
          name: string
          new_words: number
          total_words: number
          updated_at: string
        }[]
      }
      get_web_review_snapshot_v1: { Args: never; Returns: Json }
      get_web_review_snapshot_v2: { Args: never; Returns: Json }
      import_dictionary_copies_v1: {
        Args: { p_collection_id: string; p_contents: Json }
        Returns: {
          analysis_notes: string | null
          antonyms: string[]
          article: string | null
          collection_id: string | null
          conjugation: Json | null
          created_at: string
          deleted_at: string | null
          dictionary_entry_id: string | null
          dictionary_revision_id: string | null
          dutch_lemma: string
          dutch_original: string | null
          easiness_factor: number
          examples: Json[] | null
          expression_type: string | null
          image_url: string | null
          interval_days: number
          is_expression: boolean | null
          is_irregular: boolean | null
          is_reflexive: boolean | null
          is_separable: boolean | null
          last_reviewed_at: string | null
          next_review_date: string
          part_of_speech: string | null
          plural: string | null
          prefix_part: string | null
          preposition: string | null
          register: string | null
          repetition_count: number
          root_verb: string | null
          synonyms: string[]
          translations: Json
          tts_url: string
          updated_at: string | null
          usage_notes: Json | null
          user_id: string
          word_id: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'words'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      import_official_dictionary_pack_v1: {
        Args: {
          p_collection_id: string
          p_entry_ids: string[]
          p_pack_id: string
          p_version: string
        }
        Returns: {
          analysis_notes: string | null
          antonyms: string[]
          article: string | null
          collection_id: string | null
          conjugation: Json | null
          created_at: string
          deleted_at: string | null
          dictionary_entry_id: string | null
          dictionary_revision_id: string | null
          dutch_lemma: string
          dutch_original: string | null
          easiness_factor: number
          examples: Json[] | null
          expression_type: string | null
          image_url: string | null
          interval_days: number
          is_expression: boolean | null
          is_irregular: boolean | null
          is_reflexive: boolean | null
          is_separable: boolean | null
          last_reviewed_at: string | null
          next_review_date: string
          part_of_speech: string | null
          plural: string | null
          prefix_part: string | null
          preposition: string | null
          register: string | null
          repetition_count: number
          root_verb: string | null
          synonyms: string[]
          translations: Json
          tts_url: string
          updated_at: string | null
          usage_notes: Json | null
          user_id: string
          word_id: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'words'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      import_shared_dictionary_collection_v1: {
        Args: {
          p_collection_id: string
          p_share_token: string
          p_word_ids: string[]
        }
        Returns: {
          analysis_notes: string | null
          antonyms: string[]
          article: string | null
          collection_id: string | null
          conjugation: Json | null
          created_at: string
          deleted_at: string | null
          dictionary_entry_id: string | null
          dictionary_revision_id: string | null
          dutch_lemma: string
          dutch_original: string | null
          easiness_factor: number
          examples: Json[] | null
          expression_type: string | null
          image_url: string | null
          interval_days: number
          is_expression: boolean | null
          is_irregular: boolean | null
          is_reflexive: boolean | null
          is_separable: boolean | null
          last_reviewed_at: string | null
          next_review_date: string
          part_of_speech: string | null
          plural: string | null
          prefix_part: string | null
          preposition: string | null
          register: string | null
          repetition_count: number
          root_verb: string | null
          synonyms: string[]
          translations: Json
          tts_url: string
          updated_at: string | null
          usage_notes: Json | null
          user_id: string
          word_id: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'words'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      import_words_to_collection: {
        Args: { p_collection_id: string; p_words: Json }
        Returns: {
          analysis_notes: string | null
          antonyms: string[]
          article: string | null
          collection_id: string | null
          conjugation: Json | null
          created_at: string
          deleted_at: string | null
          dictionary_entry_id: string | null
          dictionary_revision_id: string | null
          dutch_lemma: string
          dutch_original: string | null
          easiness_factor: number
          examples: Json[] | null
          expression_type: string | null
          image_url: string | null
          interval_days: number
          is_expression: boolean | null
          is_irregular: boolean | null
          is_reflexive: boolean | null
          is_separable: boolean | null
          last_reviewed_at: string | null
          next_review_date: string
          part_of_speech: string | null
          plural: string | null
          prefix_part: string | null
          preposition: string | null
          register: string | null
          repetition_count: number
          root_verb: string | null
          synonyms: string[]
          translations: Json
          tts_url: string
          updated_at: string | null
          usage_notes: Json | null
          user_id: string
          word_id: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'words'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      increment_cache_usage:
        | { Args: { lemma: string }; Returns: undefined }
        | { Args: { p_cache_id: string }; Returns: undefined }
      is_cache_entry_valid: {
        Args: { cache_ttl_hours: number; created_at: string }
        Returns: boolean
      }
      learning_sync_protocol: { Args: never; Returns: number }
      persist_canonical_dictionary_analysis_v1: {
        Args: {
          p_cache_id?: string
          p_cefr_input_sha256: string
          p_content: Json
          p_content_sha256: string
          p_language_code: string
          p_resolution_id: string
          p_sense_key: string
          p_source_id: string
        }
        Returns: Json
      }
      promote_official_content_pack_version: {
        Args: { p_pack_id: string; p_promoted_at: string; p_version: string }
        Returns: undefined
      }
      publish_official_content_pack: {
        Args: {
          p_cefr_level: string
          p_content_sha256: string
          p_display_order: number
          p_entry_count: number
          p_manifest: Json
          p_published_at: string
          p_reviewed_at: string
        }
        Returns: undefined
      }
      read_dictionary_import_recovery_v1: {
        Args: { p_intent: Json }
        Returns: Json
      }
      record_review_assessment: {
        Args: {
          p_answered_correctly: boolean
          p_assessment: string
          p_event_id: string
          p_response_time_ms: number
          p_review_date: string
          p_review_mode: string
          p_reviewed_at: string
          p_word_id: string
        }
        Returns: {
          easiness_factor: number
          interval_days: number
          last_reviewed_at: string
          next_review_date: string
          repetition_count: number
          word_id: string
        }[]
      }
      recover_dictionary_import_v1: { Args: { p_request: Json }; Returns: Json }
      reset_word_learning_progress: {
        Args: {
          p_collection_id?: string
          p_reset_at: string
          p_reset_id: string
          p_review_date: string
          p_word_id: string
        }
        Returns: {
          word_id: string
        }[]
      }
      review_correction_protocol: { Args: never; Returns: number }
      sync_user_access_levels: {
        Args: never
        Returns: {
          email: string
          new_access_level: string
          old_access_level: string
          updated: boolean
          user_id: string
        }[]
      }
      uuid_generate_v1: { Args: never; Returns: string }
      uuid_generate_v1mc: { Args: never; Returns: string }
      uuid_generate_v3: {
        Args: { name: string; namespace: string }
        Returns: string
      }
      uuid_generate_v4: { Args: never; Returns: string }
      uuid_generate_v5: {
        Args: { name: string; namespace: string }
        Returns: string
      }
      uuid_nil: { Args: never; Returns: string }
      uuid_ns_dns: { Args: never; Returns: string }
      uuid_ns_oid: { Args: never; Returns: string }
      uuid_ns_url: { Args: never; Returns: string }
      uuid_ns_x500: { Args: never; Returns: string }
      withdraw_official_content_pack: {
        Args: { p_pack_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
