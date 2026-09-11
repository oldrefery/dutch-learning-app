import type { Database as GeneratedDatabase, Json } from './database.generated'

type PublicSchema = GeneratedDatabase['public']
type ReviewFunction = PublicSchema['Functions']['record_review_assessment']

type OfficialContentTables = {
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
    Relationships: []
  }
  official_content_pack_versions: {
    Row: {
      content_sha256: string
      created_at: string
      manifest: Json
      pack_id: string
      published_at: string | null
      review_status: string
      reviewed_at: string | null
      version: string
    }
    Insert: {
      content_sha256: string
      created_at?: string
      manifest: Json
      pack_id: string
      published_at?: string | null
      review_status?: string
      reviewed_at?: string | null
      version: string
    }
    Update: {
      content_sha256?: string
      created_at?: string
      manifest?: Json
      pack_id?: string
      published_at?: string | null
      review_status?: string
      reviewed_at?: string | null
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
}

// PostgreSQL RPC argument metadata does not describe accepted NULL values.
// Recognition reviews may omit correctness/timing; keep this correction separate
// from the generated schema. No undeployed protocol functions are added here.
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<PublicSchema, 'Functions' | 'Tables'> & {
    Tables: PublicSchema['Tables'] & OfficialContentTables
    Functions: Omit<PublicSchema['Functions'], 'record_review_assessment'> & {
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
      record_review_assessment: Omit<ReviewFunction, 'Args'> & {
        Args: Omit<
          ReviewFunction['Args'],
          'p_answered_correctly' | 'p_response_time_ms'
        > & {
          p_answered_correctly: boolean | null
          p_response_time_ms: number | null
        }
      }
    }
  }
}
