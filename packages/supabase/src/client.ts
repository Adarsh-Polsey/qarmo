import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Database } from './database.types';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ljldyssqgkywlsivtvpu.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_9m90ZHgJSWdQq_fRwoRbAQ_ZsT84_rG';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase environment variables are missing. Using default fallback values.',
  );
}

export const safeSecureStore = {
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    }
    try {
      if (!(await SecureStore.isAvailableAsync())) return null;
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn('SecureStore.getItemAsync failed, returning null:', e);
      return null;
    }
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    try {
      if (!(await SecureStore.isAvailableAsync())) return;
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn('SecureStore.setItemAsync failed:', e);
    }
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    try {
      if (!(await SecureStore.isAvailableAsync())) return;
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('SecureStore.deleteItemAsync failed:', e);
    }
  },
};

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return safeSecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return safeSecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return safeSecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/**
 * Signs in a user using Supabase Phone OTP.
 * Sends a verification code (SMS) to the specified phone number.
 */
export async function signInWithPhone(phone: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
  });
  if (error) throw error;
  return data;
}

/**
 * Verifies the SMS OTP token sent to the user's phone.
 */
export async function verifyOTP(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) throw error;
  return data;
}

/**
 * Signs out the current user session.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Retrieves the current session, if any exists.
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
