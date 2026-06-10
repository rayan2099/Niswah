import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

let cachedUser: User | null = null;

export const getCachedAuthUser = () => cachedUser;

export const getAuthUser = async () => {
  const { data } = await supabase.auth.getUser();
  cachedUser = data.user;
  return data.user;
};

export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  supabase.auth.getSession().then(({ data }) => {
    cachedUser = data.session?.user ?? null;
    callback(cachedUser);
  });

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    cachedUser = session?.user ?? null;
    callback(cachedUser);
  });

  return () => listener.subscription.unsubscribe();
};

export const signUpWithEmail = async (email: string, password: string, displayName: string) => {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: window.location.origin,
    },
  });
};

export const signInWithEmail = async (email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password });
};

export const signInWithProvider = async (provider: 'google' | 'apple') => {
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin,
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
    },
  });
};

export const sendPasswordReset = async (email: string) => {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
};

export const signOut = async () => {
  cachedUser = null;
  return supabase.auth.signOut();
};

