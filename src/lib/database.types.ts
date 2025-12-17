export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// 问题状态类型
export type QuestionStatus = "pending" | "published" | "ignored";

// 建议状态类型
export type SuggestionStatus =
  | "pending"
  | "reviewing"
  | "approved"
  | "in_progress"
  | "completed"
  | "rejected";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          phone: string | null;
          nickname: string;
          bio: string;
          avatar_url: string | null;
          bench_press: number;
          squat: number;
          deadlift: number;
          is_public: boolean;
          group_identity: string | null;
          profession: string | null;
          group_nickname: string | null;
          specialties: string[];
          fitness_interests: string[];
          learning_interests: string[];
          social_links: Json;
          // V2.0 新增字段
          wechat_id: string | null;
          tags: string[];
          skills_offering: string | null;
          skills_seeking: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          phone?: string | null;
          nickname: string;
          bio?: string;
          avatar_url?: string | null;
          bench_press?: number;
          squat?: number;
          deadlift?: number;
          is_public?: boolean;
          group_identity?: string | null;
          profession?: string | null;
          group_nickname?: string | null;
          specialties?: string[];
          fitness_interests?: string[];
          learning_interests?: string[];
          social_links?: Json;
          // V2.0 新增字段
          wechat_id?: string | null;
          tags?: string[];
          skills_offering?: string | null;
          skills_seeking?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone?: string | null;
          nickname?: string;
          bio?: string;
          avatar_url?: string | null;
          bench_press?: number;
          squat?: number;
          deadlift?: number;
          is_public?: boolean;
          group_identity?: string | null;
          profession?: string | null;
          group_nickname?: string | null;
          specialties?: string[];
          fitness_interests?: string[];
          learning_interests?: string[];
          social_links?: Json;
          // V2.0 新增字段
          wechat_id?: string | null;
          tags?: string[];
          skills_offering?: string | null;
          skills_seeking?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      // V2.0 新增: Q&A 提问箱
      questions: {
        Row: {
          id: string;
          content: string;
          answer: string | null;
          status: QuestionStatus;
          asker_id: string | null;
          asker_nickname: string | null;
          is_anonymous: boolean;
          tags: string[];
          view_count: number;
          is_featured: boolean;
          answered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content: string;
          answer?: string | null;
          status?: QuestionStatus;
          asker_id?: string | null;
          asker_nickname?: string | null;
          is_anonymous?: boolean;
          tags?: string[];
          view_count?: number;
          is_featured?: boolean;
          answered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          content?: string;
          answer?: string | null;
          status?: QuestionStatus;
          asker_id?: string | null;
          asker_nickname?: string | null;
          is_anonymous?: boolean;
          tags?: string[];
          view_count?: number;
          is_featured?: boolean;
          answered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      // V2.0 新增: 管理员表
      admin_users: {
        Row: {
          user_id: string;
          role: "admin" | "super_admin";
          created_at: string;
        };
        Insert: {
          user_id: string;
          role?: "admin" | "super_admin";
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role?: "admin" | "super_admin";
          created_at?: string;
        };
      };
      // V2.0 新增: 建议箱
      suggestions: {
        Row: {
          id: string;
          user_id: string | null;
          user_nickname: string | null;
          title: string;
          description: string;
          category: "fitness_tool" | "learning_tool" | "community" | "other";
          status:
            | "pending"
            | "reviewing"
            | "approved"
            | "in_progress"
            | "completed"
            | "rejected";
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          user_nickname?: string | null;
          title: string;
          description: string;
          category?: "fitness_tool" | "learning_tool" | "community" | "other";
          status?:
            | "pending"
            | "reviewing"
            | "approved"
            | "in_progress"
            | "completed"
            | "rejected";
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          user_nickname?: string | null;
          title?: string;
          description?: string;
          category?: "fitness_tool" | "learning_tool" | "community" | "other";
          status?:
            | "pending"
            | "reviewing"
            | "approved"
            | "in_progress"
            | "completed"
            | "rejected";
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      articles: {
        Row: {
          id: string;
          title: string;
          content: string;
          summary: string;
          category: string;
          type: "fitness" | "learning";
          tags: string[];
          author_id: string | null;
          author_name: string;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          summary?: string;
          category: string;
          type: "fitness" | "learning";
          tags?: string[];
          author_id?: string | null;
          author_name: string;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          summary?: string;
          category?: string;
          type?: "fitness" | "learning";
          tags?: string[];
          author_id?: string | null;
          author_name?: string;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
