import { supabase } from './supabase';

interface SessionResponse {
  data: { session: any };
  error: any;
}

interface UserResponse {
  data: { user: any };
  error: any;
}

export async function getSessionSafe(): Promise<SessionResponse> {
  try {
    const res = await supabase.auth.getSession();
    return res as SessionResponse;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.debug('getSessionSafe: aborted');
      return { data: { session: null }, error: err };
    }
    throw err;
  }
}

export async function getUserSafe(): Promise<UserResponse> {
  try {
    const res = await supabase.auth.getUser();
    return res as UserResponse;
  } catch (err: any) {
    // Abort is already handled elsewhere
    if (err?.name === 'AbortError') {
      console.debug('getUserSafe: aborted');
      return { data: { user: null }, error: err };
    }
    // network error (DNS failure / offline) should not crash the app
    if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
      console.warn('getUserSafe: network error', err.message);
      return { data: { user: null }, error: err };
    }
    throw err;
  }
}
