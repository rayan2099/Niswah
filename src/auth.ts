import type { User } from '@supabase/supabase-js';
import SHA256 from 'crypto-js/sha256';
import { supabase } from './supabase';

let cachedUser: User | null = null;

export const getCachedAuthUser = () => cachedUser;

export const clearLocalSessionCache = () => {
  if (typeof localStorage === 'undefined') return;

  localStorage.removeItem('niswah_local_user');
  localStorage.removeItem('niswah_local_entries');

  Object.keys(localStorage)
    .filter(key => key.startsWith('niswah_pregnancy_dashboard_'))
    .forEach(key => localStorage.removeItem(key));
};

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

const phoneToPrivateLoginEmail = (phone: string) => {
  const hash = SHA256(phone).toString().slice(0, 40);
  return `phone.${hash}@niswah.local`;
};

export const signUpWithPhonePassword = async (phone: string, password: string, displayName: string) => {
  return supabase.auth.signUp({
    email: phoneToPrivateLoginEmail(phone),
    password,
    options: {
      data: {
        display_name: displayName,
        phone_login: true,
        phone_last4: phone.slice(-4),
      },
      emailRedirectTo: window.location.origin,
    },
  });
};

export const signInWithPhonePassword = async (phone: string, password: string) => {
  return supabase.auth.signInWithPassword({
    email: phoneToPrivateLoginEmail(phone),
    password,
  });
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
  clearLocalSessionCache();
  return supabase.auth.signOut();
};
