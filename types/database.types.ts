// Tipos TypeScript do schema Supabase.
// Placeholder - sera regenerado por `npm run db:types` apos `supabase link`.
// Veja docs/supabase-setup.md.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface DeviceTokenRow {
  id: string;
  user_id: string;
  expo_push_token: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      // device_tokens tipado explicitamente (consumido em T1.4 p/ upsert).
      // Demais tabelas (GROUPS, PROFILES, ...) serao tipadas em T1.3a-full.
      device_tokens: {
        Row: DeviceTokenRow;
        Insert: Omit<DeviceTokenRow, 'id' | 'created_at'>;
        Update: Partial<Omit<DeviceTokenRow, 'id'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
