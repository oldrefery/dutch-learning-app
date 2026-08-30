// Generated from the linked Supabase project. Do not edit manually.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
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
          conjugation: Json | null
          created_at: string
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
          conjugation?: Json | null
          created_at?: string
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
          conjugation?: Json | null
          created_at?: string
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
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
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
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
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
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
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
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
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
