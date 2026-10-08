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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      downloads: {
        Row: {
          content_id: string
          created_at: string
          id: string
          media_type: string
          poster_url: string | null
          source: string
          title: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          media_type: string
          poster_url?: string | null
          source: string
          title: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          media_type?: string
          poster_url?: string | null
          source?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          created_at: string
          description: string | null
          duration_min: number | null
          episode_number: number
          id: string
          iframe_url: string | null
          published: boolean
          season_number: number
          series_id: string
          still_url: string | null
          subtitle_url: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          episode_number?: number
          id?: string
          iframe_url?: string | null
          published?: boolean
          season_number?: number
          series_id: string
          still_url?: string | null
          subtitle_url?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          episode_number?: number
          id?: string
          iframe_url?: string | null
          published?: boolean
          season_number?: number
          series_id?: string
          still_url?: string | null
          subtitle_url?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          content_id: string
          created_at: string
          id: string
          media_type: string
          poster_url: string | null
          source: string
          title: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          media_type: string
          poster_url?: string | null
          source: string
          title: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          media_type?: string
          poster_url?: string | null
          source?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          id: number
          name: string
          slug: string
        }
        Insert: {
          id?: number
          name: string
          slug: string
        }
        Update: {
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      movies: {
        Row: {
          age_rating: string | null
          backdrop_url: string | null
          cast_list: string[]
          category: string
          created_at: string
          description: string | null
          director: string | null
          downloadable: boolean
          duration_min: number | null
          featured: boolean
          genres: string[]
          id: string
          iframe_url: string | null
          original_title: string | null
          poster_url: string | null
          published: boolean
          rating: number | null
          release_date: string | null
          subtitle_url: string | null
          title: string
          tmdb_id: number | null
          trailer_url: string | null
          updated_at: string
          video_url: string | null
          views: number
          year: number | null
        }
        Insert: {
          age_rating?: string | null
          backdrop_url?: string | null
          cast_list?: string[]
          category?: string
          created_at?: string
          description?: string | null
          director?: string | null
          downloadable?: boolean
          duration_min?: number | null
          featured?: boolean
          genres?: string[]
          id?: string
          iframe_url?: string | null
          original_title?: string | null
          poster_url?: string | null
          published?: boolean
          rating?: number | null
          release_date?: string | null
          subtitle_url?: string | null
          title: string
          tmdb_id?: number | null
          trailer_url?: string | null
          updated_at?: string
          video_url?: string | null
          views?: number
          year?: number | null
        }
        Update: {
          age_rating?: string | null
          backdrop_url?: string | null
          cast_list?: string[]
          category?: string
          created_at?: string
          description?: string | null
          director?: string | null
          downloadable?: boolean
          duration_min?: number | null
          featured?: boolean
          genres?: string[]
          id?: string
          iframe_url?: string | null
          original_title?: string | null
          poster_url?: string | null
          published?: boolean
          rating?: number | null
          release_date?: string | null
          subtitle_url?: string | null
          title?: string
          tmdb_id?: number | null
          trailer_url?: string | null
          updated_at?: string
          video_url?: string | null
          views?: number
          year?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string
          id: string
          season_number: number
          series_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          season_number: number
          series_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          season_number?: number
          series_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          age_rating: string | null
          backdrop_url: string | null
          cast_list: string[]
          category: string
          created_at: string
          description: string | null
          director: string | null
          downloadable: boolean
          featured: boolean
          genres: string[]
          id: string
          original_title: string | null
          poster_url: string | null
          published: boolean
          rating: number | null
          title: string
          tmdb_id: number | null
          trailer_url: string | null
          updated_at: string
          views: number
          year: number | null
        }
        Insert: {
          age_rating?: string | null
          backdrop_url?: string | null
          cast_list?: string[]
          category?: string
          created_at?: string
          description?: string | null
          director?: string | null
          downloadable?: boolean
          featured?: boolean
          genres?: string[]
          id?: string
          original_title?: string | null
          poster_url?: string | null
          published?: boolean
          rating?: number | null
          title: string
          tmdb_id?: number | null
          trailer_url?: string | null
          updated_at?: string
          views?: number
          year?: number | null
        }
        Update: {
          age_rating?: string | null
          backdrop_url?: string | null
          cast_list?: string[]
          category?: string
          created_at?: string
          description?: string | null
          director?: string | null
          downloadable?: boolean
          featured?: boolean
          genres?: string[]
          id?: string
          original_title?: string | null
          poster_url?: string | null
          published?: boolean
          rating?: number | null
          title?: string
          tmdb_id?: number | null
          trailer_url?: string | null
          updated_at?: string
          views?: number
          year?: number | null
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          content_id: string
          episode_id: string | null
          id: string
          media_type: string
          poster_url: string | null
          source: string
          title: string
          user_id: string
          watched_at: string
        }
        Insert: {
          content_id: string
          episode_id?: string | null
          id?: string
          media_type: string
          poster_url?: string | null
          source: string
          title: string
          user_id: string
          watched_at?: string
        }
        Update: {
          content_id?: string
          episode_id?: string | null
          id?: string
          media_type?: string
          poster_url?: string | null
          source?: string
          title?: string
          user_id?: string
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_progress: {
        Row: {
          backdrop_url: string | null
          content_id: string
          duration_seconds: number
          episode_id: string | null
          id: string
          media_type: string
          position_seconds: number
          poster_url: string | null
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          backdrop_url?: string | null
          content_id: string
          duration_seconds?: number
          episode_id?: string | null
          id?: string
          media_type: string
          position_seconds?: number
          poster_url?: string | null
          source: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          backdrop_url?: string | null
          content_id?: string
          duration_seconds?: number
          episode_id?: string | null
          id?: string
          media_type?: string
          position_seconds?: number
          poster_url?: string | null
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_progress_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_views: {
        Args: { _id: string; _kind: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
