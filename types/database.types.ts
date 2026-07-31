export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      device_tokens: {
        Row: {
          created_at: string;
          expo_push_token: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expo_push_token: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expo_push_token?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'device_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          confirmed_at: string | null;
          created_at: string;
          description: string | null;
          group_id: string;
          id: string;
          match_id: string | null;
          paid_at: string | null;
          type: Database['public']['Enums']['expense_type'];
          updated_at: string;
        };
        Insert: {
          amount: number;
          confirmed_at?: string | null;
          created_at?: string;
          description?: string | null;
          group_id: string;
          id?: string;
          match_id?: string | null;
          paid_at?: string | null;
          type: Database['public']['Enums']['expense_type'];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          confirmed_at?: string | null;
          created_at?: string;
          description?: string | null;
          group_id?: string;
          id?: string;
          match_id?: string | null;
          paid_at?: string | null;
          type?: Database['public']['Enums']['expense_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          day_of_week: number;
          default_casual_fee: number;
          goalkeeper_expense: number;
          id: string;
          monthly_capacity: number;
          monthly_fee: number;
          name: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          day_of_week?: number;
          default_casual_fee?: number;
          goalkeeper_expense?: number;
          id?: string;
          monthly_capacity?: number;
          monthly_fee?: number;
          name: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          default_casual_fee?: number;
          goalkeeper_expense?: number;
          id?: string;
          monthly_capacity?: number;
          monthly_fee?: number;
          name?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      match_participants: {
        Row: {
          created_at: string;
          goals_assisted: number;
          goals_scored: number;
          id: string;
          is_goalkeeper: boolean;
          match_id: string;
          own_goals: number;
          player_id: string;
          team_group: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          goals_assisted?: number;
          goals_scored?: number;
          id?: string;
          is_goalkeeper?: boolean;
          match_id: string;
          own_goals?: number;
          player_id: string;
          team_group: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          goals_assisted?: number;
          goals_scored?: number;
          id?: string;
          is_goalkeeper?: boolean;
          match_id?: string;
          own_goals?: number;
          player_id?: string;
          team_group?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'match_participants_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'match_participants_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      match_presences: {
        Row: {
          confirmed_at: string | null;
          created_at: string;
          id: string;
          match_id: string;
          status: Database['public']['Enums']['rsvp_status'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          match_id: string;
          status: Database['public']['Enums']['rsvp_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          match_id?: string;
          status?: Database['public']['Enums']['rsvp_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'match_presences_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'match_presences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      matches: {
        Row: {
          created_at: string;
          date_time: string;
          day_of_week: number;
          goalkeeper_expense: number;
          group_id: string;
          id: string;
          status: Database['public']['Enums']['match_status'];
          team_scores: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          date_time: string;
          day_of_week?: number;
          goalkeeper_expense?: number;
          group_id: string;
          id?: string;
          status?: Database['public']['Enums']['match_status'];
          team_scores?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date_time?: string;
          day_of_week?: number;
          goalkeeper_expense?: number;
          group_id?: string;
          id?: string;
          status?: Database['public']['Enums']['match_status'];
          team_scores?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'matches_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          approved_at: string | null;
          created_at: string;
          group_id: string;
          id: string;
          marked_paid_at: string | null;
          match_id: string | null;
          paid_at: string | null;
          status: Database['public']['Enums']['payment_status'];
          title: string;
          type: Database['public']['Enums']['payment_type'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          approved_at?: string | null;
          created_at?: string;
          group_id: string;
          id?: string;
          marked_paid_at?: string | null;
          match_id?: string | null;
          paid_at?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          title: string;
          type: Database['public']['Enums']['payment_type'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          approved_at?: string | null;
          created_at?: string;
          group_id?: string;
          id?: string;
          marked_paid_at?: string | null;
          match_id?: string | null;
          paid_at?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          title?: string;
          type?: Database['public']['Enums']['payment_type'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string;
          group_id: string | null;
          id: string;
          is_admin: boolean;
          phone_whatsapp: string | null;
          updated_at: string;
          user_type: Database['public']['Enums']['user_type'];
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name: string;
          group_id?: string | null;
          id: string;
          is_admin?: boolean;
          phone_whatsapp?: string | null;
          updated_at?: string;
          user_type?: Database['public']['Enums']['user_type'];
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          group_id?: string | null;
          id?: string;
          is_admin?: boolean;
          phone_whatsapp?: string | null;
          updated_at?: string;
          user_type?: Database['public']['Enums']['user_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      push_log: {
        Row: {
          body: string | null;
          expo_token: string;
          http_status: number | null;
          id: string;
          kind: string;
          match_id: string | null;
          payload: Json | null;
          request_id: number | null;
          response_body: Json | null;
          sent_at: string;
          title: string | null;
          user_id: string | null;
        };
        Insert: {
          body?: string | null;
          expo_token: string;
          http_status?: number | null;
          id?: string;
          kind: string;
          match_id?: string | null;
          payload?: Json | null;
          request_id?: number | null;
          response_body?: Json | null;
          sent_at?: string;
          title?: string | null;
          user_id?: string | null;
        };
        Update: {
          body?: string | null;
          expo_token?: string;
          http_status?: number | null;
          id?: string;
          kind?: string;
          match_id?: string | null;
          payload?: Json | null;
          request_id?: number | null;
          response_body?: Json | null;
          sent_at?: string;
          title?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'push_log_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_walk_in_participant: {
        Args: { match_id: string; player_id: string; team_group: number };
        Returns: {
          created_at: string;
          goals_assisted: number;
          goals_scored: number;
          id: string;
          is_goalkeeper: boolean;
          match_id: string;
          own_goals: number;
          player_id: string;
          team_group: number;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'match_participants';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_next_weekly_match: {
        Args: { p_group_id?: string };
        Returns: undefined;
      };
      dispatch_push: {
        Args: { p_kind: string; p_match_id?: string };
        Returns: undefined;
      };
      draw_teams: {
        Args: { p_match_id: string };
        Returns: {
          is_goalkeeper: boolean;
          player_id: string;
          team_group: number;
        }[];
      };
      generate_monthly_payments: {
        Args: { p_group_id?: string };
        Returns: {
          group_name: string;
          inserted_count: number;
          month_brt: string;
          skipped_count: number;
        }[];
      };
      get_active_push_tokens: {
        Args: { p_group_id?: string };
        Returns: {
          expo_push_token: string;
          user_id: string;
          user_name: string;
        }[];
      };
      is_admin: { Args: never; Returns: boolean };
      is_group_member: { Args: { check_group_id: string }; Returns: boolean };
      promote_next_casual: { Args: { p_match_id: string }; Returns: string };
      reject_pending_presence: {
        Args: { p_presence_id: string };
        Returns: string;
      };
    };
    Enums: {
      expense_type: 'goalkeeper' | 'field' | 'other';
      match_status: 'scheduled' | 'active' | 'finished' | 'cancelled';
      payment_status: 'pending' | 'paid';
      payment_type: 'monthly' | 'casual';
      rsvp_status: 'confirmed' | 'waiting_list' | 'declined' | 'pending_approval';
      user_type: 'mensalista' | 'avulso' | 'goleiro_pago';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      expense_type: ['goalkeeper', 'field', 'other'],
      match_status: ['scheduled', 'active', 'finished', 'cancelled'],
      payment_status: ['pending', 'paid'],
      payment_type: ['monthly', 'casual'],
      rsvp_status: ['confirmed', 'waiting_list', 'declined', 'pending_approval'],
      user_type: ['mensalista', 'avulso', 'goleiro_pago'],
    },
  },
} as const;

// Aliases legados usados pelo app. O schema acima continua sendo a fonte
// gerada pelo Supabase; estes nomes preservam os contratos locais existentes.
export type UserType = Database['public']['Enums']['user_type'];
export type MatchStatus = Database['public']['Enums']['match_status'];
export type RsvpStatus = Database['public']['Enums']['rsvp_status'];
export type PaymentType = Database['public']['Enums']['payment_type'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];
export type ExpenseType = Database['public']['Enums']['expense_type'];

export type GroupRow = Database['public']['Tables']['groups']['Row'];
export type GroupInsert = Database['public']['Tables']['groups']['Insert'];
export type GroupUpdate = Database['public']['Tables']['groups']['Update'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type MatchRow = Database['public']['Tables']['matches']['Row'];
export type MatchInsert = Database['public']['Tables']['matches']['Insert'];
export type MatchUpdate = Database['public']['Tables']['matches']['Update'];
export type MatchPresenceRow = Database['public']['Tables']['match_presences']['Row'];
export type MatchPresenceInsert = Database['public']['Tables']['match_presences']['Insert'];
export type MatchPresenceUpdate = Database['public']['Tables']['match_presences']['Update'];
export type MatchParticipantRow = Database['public']['Tables']['match_participants']['Row'];
export type MatchParticipantInsert = Database['public']['Tables']['match_participants']['Insert'];
export type MatchParticipantUpdate = Database['public']['Tables']['match_participants']['Update'];
export type PaymentRow = Database['public']['Tables']['payments']['Row'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
export type PaymentUpdate = Database['public']['Tables']['payments']['Update'];
export type ExpenseRow = Database['public']['Tables']['expenses']['Row'];
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];
export type DeviceTokenRow = Database['public']['Tables']['device_tokens']['Row'];
export type DeviceTokenInsert = Database['public']['Tables']['device_tokens']['Insert'];
export type DeviceTokenUpdate = Database['public']['Tables']['device_tokens']['Update'];

export type TableName = keyof Database['public']['Tables'];
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];
export type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
export type Update<T extends TableName> = Database['public']['Tables'][T]['Update'];
