/**
 * types/database.types.ts
 * Tipos TypeScript do schema Supabase (mirror de 00000000000001_schema.sql).
 *
 * Formatado para compatibilidade com `@supabase/supabase-js` v2
 * (`Database['public']['Tables']['<name>']['Row' | 'Insert' | 'Update']`).
 *
 * Processo oficial: `npm run db:types` apos `supabase link` gera esses tipos
 * automaticamente. Este arquivo hand-written e baseline ate o Supabase CLI
 * estar linkado ao projeto remoto (ver docs/supabase-setup.md). Ao rodar
 * `db:types` pela primeira vez, ele sobrescrevera este conteudo mantendo a
 * mesma estrutura (idempotente).
 *
 * Constraints:
 *   - Enums como union literals (mais ergonomicos que `typeof Enum[keyof]`).
 *   - Timestamps como `string` (ISO 8601 UTC via timestamptz).
 *   - JSONB via `Json` recursiva (compativel com supabase-js v2).
 *   - Updates `Partial<...>` exceto o PK (id).
 */

// ----- JSONB ---------------------------------------------------------------

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ----- ENUMS (mirror dos CREATE TYPE em 00000000000001_schema.sql) --------

export type UserType = 'mensalista' | 'avulso' | 'goleiro_pago';
export type MatchStatus = 'scheduled' | 'active' | 'finished' | 'cancelled';
export type RsvpStatus = 'confirmed' | 'waiting_list' | 'declined' | 'pending_approval';
export type PaymentType = 'monthly' | 'casual';
export type PaymentStatus = 'pending' | 'paid';
export type ExpenseType = 'goalkeeper' | 'field' | 'other';

// ----- TABLE: groups -------------------------------------------------------

export interface GroupRow {
  id: string;
  name: string;
  day_of_week: number;
  monthly_fee: number;
  default_casual_fee: number;
  goalkeeper_expense: number;
  monthly_capacity: number;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export type GroupInsert = Omit<GroupRow, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<GroupRow, 'id' | 'created_at' | 'updated_at'>>;
export type GroupUpdate = Partial<Omit<GroupRow, 'id'>>;

// ----- TABLE: profiles -----------------------------------------------------

export interface ProfileRow {
  id: string;
  group_id: string | null;
  full_name: string;
  phone_whatsapp: string | null;
  user_type: UserType;
  is_admin: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<ProfileRow, 'id' | 'created_at' | 'updated_at'>>;
export type ProfileUpdate = Partial<Omit<ProfileRow, 'id'>>;

// ----- TABLE: matches ------------------------------------------------------

export interface MatchRow {
  id: string;
  group_id: string;
  date_time: string;
  day_of_week: number;
  team_scores: Json;
  goalkeeper_expense: number;
  status: MatchStatus;
  created_at: string;
  updated_at: string;
}

export type MatchInsert = Omit<MatchRow, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<MatchRow, 'id' | 'created_at' | 'updated_at'>>;
export type MatchUpdate = Partial<Omit<MatchRow, 'id'>>;

// ----- TABLE: match_presences ----------------------------------------------

export interface MatchPresenceRow {
  id: string;
  match_id: string;
  user_id: string;
  status: RsvpStatus;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MatchPresenceInsert = Omit<MatchPresenceRow, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<MatchPresenceRow, 'id' | 'created_at' | 'updated_at'>>;
export type MatchPresenceUpdate = Partial<Omit<MatchPresenceRow, 'id'>>;

// ----- TABLE: match_participants -------------------------------------------

export interface MatchParticipantRow {
  id: string;
  match_id: string;
  player_id: string;
  team_group: number;
  is_goalkeeper: boolean;
  goals_scored: number;
  goals_assisted: number;
  own_goals: number;
  created_at: string;
  updated_at: string;
}

export type MatchParticipantInsert = Omit<MatchParticipantRow, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<MatchParticipantRow, 'id' | 'created_at' | 'updated_at'>>;
export type MatchParticipantUpdate = Partial<Omit<MatchParticipantRow, 'id'>>;

// ----- TABLE: payments -----------------------------------------------------

export interface PaymentRow {
  id: string;
  user_id: string;
  match_id: string | null;
  group_id: string;
  type: PaymentType;
  title: string;
  amount: number;
  status: PaymentStatus;
  marked_paid_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentInsert = Omit<PaymentRow, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<PaymentRow, 'id' | 'created_at' | 'updated_at'>>;
export type PaymentUpdate = Partial<Omit<PaymentRow, 'id'>>;

// ----- TABLE: expenses -----------------------------------------------------

export interface ExpenseRow {
  id: string;
  group_id: string;
  match_id: string | null;
  type: ExpenseType;
  description: string | null;
  amount: number;
  paid_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseInsert = Omit<ExpenseRow, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<ExpenseRow, 'id' | 'created_at' | 'updated_at'>>;
export type ExpenseUpdate = Partial<Omit<ExpenseRow, 'id'>>;

// ----- TABLE: device_tokens ------------------------------------------------

export interface DeviceTokenRow {
  id: string;
  user_id: string;
  expo_push_token: string;
  created_at: string;
}

export type DeviceTokenInsert = Omit<DeviceTokenRow, 'id' | 'created_at'> &
  Partial<Pick<DeviceTokenRow, 'id' | 'created_at'>>;
export type DeviceTokenUpdate = Partial<Omit<DeviceTokenRow, 'id'>>;

// ----- Database (formato supabase-js v2) -----------------------------------

export interface Database {
  public: {
    Tables: {
      groups: {
        Row: GroupRow;
        Insert: GroupInsert;
        Update: GroupUpdate;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      matches: {
        Row: MatchRow;
        Insert: MatchInsert;
        Update: MatchUpdate;
        Relationships: [];
      };
      match_presences: {
        Row: MatchPresenceRow;
        Insert: MatchPresenceInsert;
        Update: MatchPresenceUpdate;
        Relationships: [];
      };
      match_participants: {
        Row: MatchParticipantRow;
        Insert: MatchParticipantInsert;
        Update: MatchParticipantUpdate;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: PaymentInsert;
        Update: PaymentUpdate;
        Relationships: [];
      };
      expenses: {
        Row: ExpenseRow;
        Insert: ExpenseInsert;
        Update: ExpenseUpdate;
        Relationships: [];
      };
      device_tokens: {
        Row: DeviceTokenRow;
        Insert: DeviceTokenInsert;
        Update: DeviceTokenUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_type: UserType;
      match_status: MatchStatus;
      rsvp_status: RsvpStatus;
      payment_type: PaymentType;
      payment_status: PaymentStatus;
      expense_type: ExpenseType;
    };
  };
}

// ----- Aliases (uso comum em stores/components) ----------------------------

/** Alias para o nome de tabela. Centralizado para evitar erros de digitacao. */
export type TableName = keyof Database['public']['Tables'];

/** Tipo do registro completo de uma tabela. */
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];

/** Tipo do payload de insercao. */
export type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert'];

/** Tipo do payload de atualizacao. */
export type Update<T extends TableName> = Database['public']['Tables'][T]['Update'];
