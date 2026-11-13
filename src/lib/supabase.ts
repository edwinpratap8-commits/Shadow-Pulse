import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export interface PlayerProfile {
  id: string;
  username: string;
  is_commander: boolean;
  coins: number;
}

export async function ensurePlayerSession(): Promise<PlayerProfile | null> {
  if (!supabase) {
    console.warn('[Auth] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    return null;
  }

  let { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) {
      console.error('[Auth] Anonymous sign-in failed:', error);
      return null;
    }
    session = data.session;
  }

  const { data: profile } = await supabase
    .from('players')
    .select('id, username, is_commander, coins')
    .eq('id', session.user.id)
    .single();

  return profile as PlayerProfile | null;
        }
