// Tipos TypeScript do schema Supabase.
// Placeholder - sera regenerado por `npm run db:types` apos `supabase link`.
// Veja docs/supabase-setup.md.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // T1.3a preenchera: GROUPS, PROFILES, MATCHES, MATCH_PRESENCES,
      // MATCH_PARTICIPANTS, PAYMENTS, EXPENSES, DEVICE_TOKENS.
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      // user_type, match_status, rsvp_status, payment_type, payment_status, expense_type
      [key: string]: string;
    };
  };
}
