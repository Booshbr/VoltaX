/**
 * Database types for the VoltaX schema (supabase/migrations/0001_init.sql).
 * Hand-authored to match the migration; regenerate with the Supabase CLI
 * (`supabase gen types typescript`) once a project is linked. Only the tables the
 * app reads/writes are typed here — enough to give the repositories type safety.
 *
 * NOTE: row shapes are `type` aliases (not `interface`) so they satisfy
 * supabase-js's `Record<string, unknown>` table constraint — an interface without
 * an index signature does not, which silently degrades inserts to `never`.
 */

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type SignalsRow = {
  id: string;
  user_id: string;
  instrument_symbol: string;
  instrument_family: string;
  direction: 'long' | 'short';
  mode: 'structure' | 'setup' | 'entry' | 'precision';
  status: string;
  entry_price: number;
  stop_loss: number;
  take_profits: Json;
  risk_reward: number;
  reliability_score: number;
  opportunity_score: number;
  methodology_version: string;
  market_context: Json;
  setup_context: Json;
  entry_context: Json;
  risk_context: Json;
  created_at: string;
  updated_at: string;
};

type SignalReasonsRow = {
  id: string;
  signal_id: string;
  category: string;
  code: string;
  text: string;
  polarity: 'supporting' | 'cautionary';
};

type SignalEventsRow = {
  id: string;
  signal_id: string;
  from_status: string;
  to_status: string;
  price: number | null;
  note: string;
  created_at: string;
};

type PaperTradesRow = {
  id: string;
  user_id: string;
  signal_id: string | null;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number | null;
  status: string;
  pnl: number | null;
  opened_at: string;
  closed_at: string | null;
};

type NotificationEventsRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

type AuditLogsRow = {
  id: string;
  user_id: string | null;
  event: string;
  detail: Json;
  created_at: string;
};

type ProfilesRow = {
  id: string;
  display_name: string | null;
  created_at: string;
};

type PushSubscriptionsRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
};

type SignalOutcomesRow = {
  id: string;
  symbol: string;
  family: string;
  direction: 'long' | 'short';
  entry: number;
  stop_loss: number;
  take_profit: number;
  risk_reward: number;
  methodology_version: string;
  dedup_key: string;
  status: 'pending' | 'win' | 'loss' | 'expired';
  resolution_price: number | null;
  resolved_at: string | null;
  bars_to_resolve: number | null;
  created_at: string;
};

/** Helper: an Insert type is the Row with server-defaulted columns optional. */
type Insert<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

type TableDef<Row, Ins> = {
  Row: Row;
  Insert: Ins;
  Update: Partial<Ins>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      signals: TableDef<SignalsRow, Insert<SignalsRow, 'id' | 'created_at' | 'updated_at'>>;
      signal_reasons: TableDef<SignalReasonsRow, Insert<SignalReasonsRow, 'id'>>;
      signal_events: TableDef<SignalEventsRow, Insert<SignalEventsRow, 'id' | 'created_at'>>;
      paper_trades: TableDef<PaperTradesRow, Insert<PaperTradesRow, 'id' | 'opened_at'>>;
      notification_events: TableDef<
        NotificationEventsRow,
        Insert<NotificationEventsRow, 'id' | 'created_at' | 'read'>
      >;
      audit_logs: TableDef<AuditLogsRow, Insert<AuditLogsRow, 'id' | 'created_at'>>;
      profiles: TableDef<ProfilesRow, Insert<ProfilesRow, 'created_at'>>;
      signal_outcomes: TableDef<
        SignalOutcomesRow,
        Insert<SignalOutcomesRow, 'id' | 'created_at' | 'status' | 'resolution_price' | 'resolved_at' | 'bars_to_resolve'>
      >;
      push_subscriptions: TableDef<
        PushSubscriptionsRow,
        Insert<PushSubscriptionsRow, 'id' | 'created_at' | 'user_agent'>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type { Json };
