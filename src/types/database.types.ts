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
      clubs: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          city: string | null
          country: string
          plan: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['clubs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['clubs']['Insert']>
      }
      club_settings: {
        Row: {
          id: string
          club_id: string
          quota_amounts: Json
          quota_deadline_day: number
          special_quota_cases: Json
          google_sheets_id: string | null
          google_refresh_token: string | null
          google_service_email: string | null
          gmail_from_address: string | null
          inscription_open: boolean
          sanction_yellow_threshold: number
          sanction_matches: number
        }
        Insert: Omit<Database['public']['Tables']['club_settings']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['club_settings']['Insert']>
      }
      club_members: {
        Row: {
          id: string
          club_id: string
          user_id: string | null
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          active: boolean
          created_at: string
          form_link: string | null
          form_sent: boolean
          form_sent_at: string | null
          dni: string | null
          birth_date: string | null
          notes: string | null
          doc_dni_url: string | null
          doc_antecedentes_url: string | null
          doc_delitos_sexuales_url: string | null
          doc_licencia_url: string | null
          doc_titulacion_url: string | null
          doc_contrato_url: string | null
        }
        Insert: Omit<Database['public']['Tables']['club_members']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['club_members']['Insert']>
      }
      club_member_roles: {
        Row: {
          id: string
          member_id: string
          role: string
          team_id: string | null
        }
        Insert: Omit<Database['public']['Tables']['club_member_roles']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['club_member_roles']['Insert']>
      }
      players: {
        Row: {
          id: string
          club_id: string
          first_name: string
          last_name: string
          photo_url: string | null
          birth_date: string | null
          dni: string | null
          nationality: string | null
          tutor_name: string | null
          tutor_email: string | null
          tutor_phone: string | null
          tutor2_name: string | null
          tutor2_email: string | null
          position: string | null
          dominant_foot: string | null
          height_cm: number | null
          weight_kg: number | null
          team_id: string | null
          next_team_id: string | null
          dorsal_number: number | null
          status: string
          sheets_row_index: number | null
          forms_link: string | null
          wants_to_continue: boolean | null
          meets_requirements: boolean | null
          made_reservation: boolean | null
          email_team_assignment_sent: boolean
          email_request_docs_sent: boolean
          email_fill_form_sent: boolean
          email_admitted_sent: boolean
          license_type: string | null
          spanish_nationality: boolean | null
          dni_front_url: string | null
          dni_back_url: string | null
          birth_cert_url: string | null
          residency_cert_url: string | null
          passport_url: string | null
          nie_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      teams: {
        Row: {
          id: string
          club_id: string
          category_id: string | null
          name: string
          coordinator_id: string | null
          season: string
          active: boolean
        }
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
      }
      sessions: {
        Row: {
          id: string
          club_id: string
          team_id: string
          session_type: string
          session_date: string
          opponent: string | null
          score_home: number | null
          score_away: number | null
          notes: string | null
          logged_by: string | null
          is_live: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['sessions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>
      }
      injuries: {
        Row: {
          id: string
          club_id: string
          player_id: string
          reported_by: string | null
          injury_type: string | null
          description: string | null
          injured_at: string
          recovered_at: string | null
          status: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['injuries']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['injuries']['Insert']>
      }
      quota_payments: {
        Row: {
          id: string
          club_id: string
          player_id: string
          season: string
          month: number | null
          concept: string | null
          amount_due: number
          amount_paid: number
          payment_date: string | null
          payment_method: string | null
          status: string
          notes: string | null
          email_sent: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['quota_payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['quota_payments']['Insert']>
      }
      exercises: {
        Row: {
          id: string
          club_id: string
          title: string
          description: string | null
          category_id: string | null
          objective_tags: string[]
          canvas_data: Json | null
          canvas_image_url: string | null
          author_id: string | null
          is_public: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['exercises']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['exercises']['Insert']>
      }
      exercise_categories: {
        Row: {
          id: string
          club_id: string
          name: string
          color: string
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['exercise_categories']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['exercise_categories']['Insert']>
      }
      communications: {
        Row: {
          id: string
          club_id: string
          sent_by: string | null
          template_id: string | null
          subject: string
          body_html: string
          recipient_type: string
          recipient_ids: string[] | null
          recipient_filter: Json | null
          sent_at: string | null
          status: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['communications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['communications']['Insert']>
      }
      scouting_reports: {
        Row: {
          id: string
          club_id: string
          session_id: string | null
          reported_by: string | null
          rival_team: string
          dorsal: string | null
          position: string | null
          comment: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['scouting_reports']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['scouting_reports']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_club_id: {
        Args: Record<string, never>
        Returns: string
      }
      get_my_roles: {
        Args: Record<string, never>
        Returns: string[]
      }
    }
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Club = Tables<'clubs'>
export type ClubSettings = Tables<'club_settings'>
export type ClubMember = Tables<'club_members'>
export type Player = Tables<'players'>
export type Team = Tables<'teams'>
export type Session = Tables<'sessions'>
export type Injury = Tables<'injuries'>
export type QuotaPayment = Tables<'quota_payments'>
export type Exercise = Tables<'exercises'>
export type ExerciseCategory = Tables<'exercise_categories'>
export type Communication = Tables<'communications'>
export type ScoutingReport = Tables<'scouting_reports'>
