import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PlayerProfile {
  id: string;
  username: string;
  is_commander: boolean;
  coins: number;
}

// Automatically signs player in as a persistent guest if not logged in
export async function ensurePlayerSession(): Promise<PlayerProfile | null> {
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

