/**
 * Public schema types reviewed against 20260928000200_game_stats.sql.
 * Regenerate from the applied project schema when Supabase CLI access is available.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      game_stats: {
        Row: {
          user_id: string
          game_id: string
          rng_wins: number
          rng_losses: number
          rng_draws: number
          jev_wins: number
          jev_losses: number
          jev_draws: number
          last_match_id: string
          last_match_completed_at: string
        }
        Insert: {
          user_id: string
          game_id: string
          rng_wins?: number
          rng_losses?: number
          rng_draws?: number
          jev_wins?: number
          jev_losses?: number
          jev_draws?: number
          last_match_id: string
          last_match_completed_at: string
        }
        Update: {
          user_id?: string
          game_id?: string
          rng_wins?: number
          rng_losses?: number
          rng_draws?: number
          jev_wins?: number
          jev_losses?: number
          jev_draws?: number
          last_match_id?: string
          last_match_completed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'game_stats_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      record_game_result: {
        Args: {
          p_game_id: string
          p_opponent: string
          p_result: string
          p_match_id: string
        }
        Returns: Database['public']['Tables']['game_stats']['Row']
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
