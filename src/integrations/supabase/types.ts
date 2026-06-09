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
      coach_assignments: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          student_status: string
          user_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          student_status?: string
          user_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          student_status?: string
          user_id?: string
        }
        Relationships: []
      }
      coaching_contents: {
        Row: {
          body: string
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_global: boolean
          owner_id: string | null
          persona_id: string | null
          tags: string[] | null
          target_user_id: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_global?: boolean
          owner_id?: string | null
          persona_id?: string | null
          tags?: string[] | null
          target_user_id?: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_global?: boolean
          owner_id?: string | null
          persona_id?: string | null
          tags?: string[] | null
          target_user_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_contents_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_reasons: {
        Row: {
          created_at: string
          id: string
          label: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          amount: number
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          owner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          lead_id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          lead_id: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          call_proposed_at: string | null
          campaign_tag: string | null
          closed_lost_at: string | null
          coach_notes: string | null
          company_name: string | null
          conversation_started_at: string | null
          created_at: string
          custom_tags: string[] | null
          disqualification_reason:
            | Database["public"]["Enums"]["disqualification_reason_type"]
            | null
          first_name: string
          first_response_at: string | null
          follow_up_date: string | null
          follow_up_level: number
          id: string
          job_title: string | null
          last_name: string
          last_status_change_at: string | null
          linkedin_url: string | null
          loss_reason: Database["public"]["Enums"]["loss_reason_type"] | null
          meeting_booked_at: string | null
          notes: string | null
          outreach_type:
            | Database["public"]["Enums"]["outreach_type_enum"]
            | null
          owner_id: string
          persona_id: string | null
          reason_detail: string | null
          setter_id: string
          source_type: Database["public"]["Enums"]["source_type_enum"] | null
          status: Database["public"]["Enums"]["lead_status"]
          unipile_chat_id: string | null
          unqualified_at: string | null
          updated_at: string
        }
        Insert: {
          call_proposed_at?: string | null
          campaign_tag?: string | null
          closed_lost_at?: string | null
          coach_notes?: string | null
          company_name?: string | null
          conversation_started_at?: string | null
          created_at?: string
          custom_tags?: string[] | null
          disqualification_reason?:
            | Database["public"]["Enums"]["disqualification_reason_type"]
            | null
          first_name: string
          first_response_at?: string | null
          follow_up_date?: string | null
          follow_up_level?: number
          id?: string
          job_title?: string | null
          last_name: string
          last_status_change_at?: string | null
          linkedin_url?: string | null
          loss_reason?: Database["public"]["Enums"]["loss_reason_type"] | null
          meeting_booked_at?: string | null
          notes?: string | null
          outreach_type?:
            | Database["public"]["Enums"]["outreach_type_enum"]
            | null
          owner_id: string
          persona_id?: string | null
          reason_detail?: string | null
          setter_id?: string
          source_type?: Database["public"]["Enums"]["source_type_enum"] | null
          status?: Database["public"]["Enums"]["lead_status"]
          unipile_chat_id?: string | null
          unqualified_at?: string | null
          updated_at?: string
        }
        Update: {
          call_proposed_at?: string | null
          campaign_tag?: string | null
          closed_lost_at?: string | null
          coach_notes?: string | null
          company_name?: string | null
          conversation_started_at?: string | null
          created_at?: string
          custom_tags?: string[] | null
          disqualification_reason?:
            | Database["public"]["Enums"]["disqualification_reason_type"]
            | null
          first_name?: string
          first_response_at?: string | null
          follow_up_date?: string | null
          follow_up_level?: number
          id?: string
          job_title?: string | null
          last_name?: string
          last_status_change_at?: string | null
          linkedin_url?: string | null
          loss_reason?: Database["public"]["Enums"]["loss_reason_type"] | null
          meeting_booked_at?: string | null
          notes?: string | null
          outreach_type?:
            | Database["public"]["Enums"]["outreach_type_enum"]
            | null
          owner_id?: string
          persona_id?: string | null
          reason_detail?: string | null
          setter_id?: string
          source_type?: Database["public"]["Enums"]["source_type_enum"] | null
          status?: Database["public"]["Enums"]["lead_status"]
          unipile_chat_id?: string | null
          unqualified_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: Database["public"]["Enums"]["membership_plan"]
          status: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["membership_plan"]
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["membership_plan"]
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          coach_notes: string | null
          company_size: string | null
          created_at: string
          created_by: string
          description: string | null
          frequent_objections: string | null
          id: string
          main_problems: string | null
          maturity_level: string | null
          name: string
          objectives: string | null
          recommended_approach: string | null
          sector: string | null
          target_role: string | null
          target_type: string | null
          updated_at: string
        }
        Insert: {
          coach_notes?: string | null
          company_size?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          frequent_objections?: string | null
          id?: string
          main_problems?: string | null
          maturity_level?: string | null
          name: string
          objectives?: string | null
          recommended_approach?: string | null
          sector?: string | null
          target_role?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Update: {
          coach_notes?: string | null
          company_size?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          frequent_objections?: string | null
          id?: string
          main_problems?: string | null
          maturity_level?: string | null
          name?: string
          objectives?: string | null
          recommended_approach?: string | null
          sector?: string | null
          target_role?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_type: string | null
          created_at: string
          debug_role_switch_enabled: boolean
          email: string | null
          full_name: string | null
          id: string
          industry: string | null
          monthly_revenue: string | null
          onboarding_completed: boolean
          prospecting_volume: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_type?: string | null
          created_at?: string
          debug_role_switch_enabled?: boolean
          email?: string | null
          full_name?: string | null
          id: string
          industry?: string | null
          monthly_revenue?: string | null
          onboarding_completed?: boolean
          prospecting_volume?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_type?: string | null
          created_at?: string
          debug_role_switch_enabled?: boolean
          email?: string | null
          full_name?: string | null
          id?: string
          industry?: string | null
          monthly_revenue?: string | null
          onboarding_completed?: boolean
          prospecting_volume?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      script_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          lead_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          snoozed_until: string | null
          source: string
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          lead_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          snoozed_until?: string | null
          source?: string
          status?: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          lead_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          snoozed_until?: string | null
          source?: string
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unipile_accounts: {
        Row: {
          account_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unipile_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          badge_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_personas: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          is_primary: boolean
          persona_id: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          is_primary?: boolean
          persona_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          persona_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_personas_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_business_days: {
        Args: { _days: number; _start: string }
        Returns: string
      }
      bootstrap_current_user: {
        Args: { _full_name?: string }
        Returns: undefined
      }
      get_coached_user_ids: { Args: { _coach_id: string }; Returns: string[] }
      get_leaderboard: {
        Args: { _coach_id?: string; _from: string; _to: string }
        Returns: {
          avatar_url: string
          calls_proposed: number
          conversations: number
          full_name: string
          meetings_booked: number
          responses: number
          score: number
          user_id: string
        }[]
      }
      get_team_members: { Args: { _user_id: string }; Returns: string[] }
      get_user_streak: {
        Args: { _user_id: string }
        Returns: {
          current_streak: number
          longest_streak: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coach_of: {
        Args: { _coach_id: string; _user_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      set_debug_role_access: {
        Args: { _enabled: boolean; _target_user_id: string }
        Returns: undefined
      }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "user" | "coach" | "admin"
      content_type: "script" | "objection" | "recommendation" | "coach_note"
      disqualification_reason_type:
        | "hors_icp"
        | "activite_non_pertinente"
        | "trop_debutant"
        | "trop_avance"
        | "pas_decideur"
        | "mauvaise_cible"
        | "autre"
      lead_status:
        | "conversation_engagee"
        | "en_cours"
        | "appel_propose"
        | "follow_up"
        | "rendez_vous_booke"
        | "ferme_perdu"
        | "non_qualifie"
      loss_reason_type:
        | "pas_interesse"
        | "pas_le_bon_timing"
        | "pas_de_budget"
        | "ne_repond_plus"
        | "deja_accompagne"
        | "objection_non_levee"
        | "autre"
      membership_plan: "free" | "starter" | "pro" | "coach"
      membership_status:
        | "active"
        | "trialing"
        | "canceled"
        | "past_due"
        | "incomplete"
      outreach_type_enum: "message_texte" | "video" | "vocal" | "autre"
      source_type_enum: "manuel" | "campagne" | "inbound" | "referral" | "autre"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "completed" | "cancelled"
      task_type:
        | "conversation_followup"
        | "booking_followup"
        | "manual_followup"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "coach", "admin"],
      content_type: ["script", "objection", "recommendation", "coach_note"],
      disqualification_reason_type: [
        "hors_icp",
        "activite_non_pertinente",
        "trop_debutant",
        "trop_avance",
        "pas_decideur",
        "mauvaise_cible",
        "autre",
      ],
      lead_status: [
        "conversation_engagee",
        "en_cours",
        "appel_propose",
        "follow_up",
        "rendez_vous_booke",
        "ferme_perdu",
        "non_qualifie",
      ],
      loss_reason_type: [
        "pas_interesse",
        "pas_le_bon_timing",
        "pas_de_budget",
        "ne_repond_plus",
        "deja_accompagne",
        "objection_non_levee",
        "autre",
      ],
      membership_plan: ["free", "starter", "pro", "coach"],
      membership_status: [
        "active",
        "trialing",
        "canceled",
        "past_due",
        "incomplete",
      ],
      outreach_type_enum: ["message_texte", "video", "vocal", "autre"],
      source_type_enum: ["manuel", "campagne", "inbound", "referral", "autre"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "completed", "cancelled"],
      task_type: [
        "conversation_followup",
        "booking_followup",
        "manual_followup",
      ],
    },
  },
} as const
