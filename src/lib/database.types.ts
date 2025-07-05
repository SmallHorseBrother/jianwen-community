export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          phone: string | null
          nickname: string
          bio: string
          avatar_url: string | null
          bench_press: number
          squat: number
          deadlift: number
          is_public: boolean
          group_identity: string | null
          profession: string | null
          group_nickname: string | null
          specialties: string[]
          fitness_interests: string[]
          learning_interests: string[]
          social_links: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          phone?: string | null
          nickname: string
          bio?: string
          avatar_url?: string | null
          bench_press?: number
          squat?: number
          deadlift?: number
          is_public?: boolean
          group_identity?: string | null
          profession?: string | null
          group_nickname?: string | null
          specialties?: string[]
          fitness_interests?: string[]
          learning_interests?: string[]
          social_links?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string | null
          nickname?: string
          bio?: string
          avatar_url?: string | null
          bench_press?: number
          squat?: number
          deadlift?: number
          is_public?: boolean
          group_identity?: string | null
          profession?: string | null
          group_nickname?: string | null
          specialties?: string[]
          fitness_interests?: string[]
          learning_interests?: string[]
          social_links?: Json
          created_at?: string
          updated_at?: string
        }
      }
      articles: {
        Row: {
          id: string
          title: string
          content: string
          summary: string
          category: string
          type: 'fitness' | 'learning'
          tags: string[]
          author_id: string | null
          author_name: string
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          summary?: string
          category: string
          type: 'fitness' | 'learning'
          tags?: string[]
          author_id?: string | null
          author_name: string
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          summary?: string
          category?: string
          type?: 'fitness' | 'learning'
          tags?: string[]
          author_id?: string | null
          author_name?: string
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}