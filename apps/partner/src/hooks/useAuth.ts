import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  supabase,
  signInWithPhone as supabaseSignIn,
  verifyOTP as supabaseVerify,
  signOut as supabaseSignOut,
  getSession as supabaseGetSession,
  Session,
  User,
  safeSecureStore as SecureStore,
} from '@qarmo/supabase';
import { DEFAULT_COUNTRY_CODE } from '@qarmo/core';
import { logger } from '../utils/logger';

const TAG = 'Auth';

// Define profile type from supabase schema
export interface UserProfile {
  id: string;
  phone: string;
  full_name: string | null;
  photo_url: string | null;
  roles: string[];
  city: string | null;
  referral_code: string | null;
  profile_completed_at: string | null;
  created_at: string;
  account_type: string;
  partner_type: string | null;
  plate_number?: string | null;
  referred_by?: string | null;
  last_location: any | null;
  location_updated_at: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isCheckingProfile: boolean;
  /** True only when the last profile fetch failed (network/DB error) — not when the row simply doesn't exist yet. */
  profileFetchError: boolean;
  signInWithPhone: (phone: string) => Promise<any>;
  verifyOTP: (
    phone: string,
    token: string,
  ) => Promise<{ session: Session | null; user: User | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [profileFetchError, setProfileFetchError] = useState(false);

  // Supabase fires onAuthStateChange('SIGNED_IN') right after verifyOtp() resolves.
  // verifyOTP() below already fetches the profile itself, so this ref lets the listener
  // skip re-fetching for that same sign-in — set right before verifyOTP's own fetch,
  // consumed (and cleared) by the very next matching auth event.
  const skipNextProfileFetchForUserIdRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    const done = logger.time(TAG, `fetchProfile(${userId})`);
    try {
      setIsCheckingProfile(true);
      // maybeSingle (not single): a brand-new signup may not have a profiles row yet
      // (created by a DB trigger) — that's a normal null result, not a fetch error.
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

      if (error) {
        console.warn('Profile fetch warning/error:', error.message);
        setProfileFetchError(true);
        done('fail', { code: error.code, message: error.message });
        return null;
      }
      setProfileFetchError(false);
      done('ok', {
        found: !!data,
        accountType: data?.account_type ?? null,
        profileCompleted: !!data?.profile_completed_at,
      });
      return data as UserProfile | null;
    } catch (e: any) {
      console.error('Failed to fetch profile:', e);
      setProfileFetchError(true);
      done('fail', { message: e?.message });
      return null;
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const refreshProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    const updatedProfile = await fetchProfile(user.id);
    setProfile(updatedProfile);
    return updatedProfile;
  };

  useEffect(() => {
    logger.info(TAG, 'Checking for an existing session...');
    supabaseGetSession()
      .then(async (activeSession) => {
        setSession(activeSession);
        const currentUser = activeSession?.user ?? null;
        setUser(currentUser);
        logger.info(TAG, `Initial session ${currentUser ? 'found' : 'not found'}`, {
          userId: currentUser?.id ?? null,
        });

        if (currentUser) {
          const userProfile = await fetchProfile(currentUser.id);
          setProfile(userProfile);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error getting initial session:', err);
        logger.error(TAG, 'Initial session check threw', { message: err?.message });
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      const currentUser = newSession?.user ?? null;
      logger.info(TAG, `onAuthStateChange: ${event}`, { userId: currentUser?.id ?? null });
      setSession(newSession);
      setUser(currentUser);

      if (currentUser) {
        if (skipNextProfileFetchForUserIdRef.current === currentUser.id) {
          logger.info(TAG, 'Skipping profile re-fetch (already fetched by verifyOTP for this sign-in)');
          skipNextProfileFetchForUserIdRef.current = null;
        } else {
          const userProfile = await fetchProfile(currentUser.id);
          setProfile(userProfile);
        }
      } else {
        skipNextProfileFetchForUserIdRef.current = null;
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPhone = async (phone: string) => {
    const done = logger.time(TAG, 'signInWithPhone (send OTP)');
    try {
      const result = await supabaseSignIn(phone);
      done('ok');
      return result;
    } catch (e: any) {
      done('fail', { message: e?.message });
      throw e;
    }
  };

  const verifyOTP = async (phone: string, token: string) => {
    const done = logger.time(TAG, 'verifyOTP');
    const data = await supabaseVerify(phone, token);
    const currentUser = data.user ?? null;
    const currentSession = data.session ?? null;

    setSession(currentSession);
    setUser(currentUser);

    if (currentUser) {
      skipNextProfileFetchForUserIdRef.current = currentUser.id;
      const userProfile = await fetchProfile(currentUser.id);
      setProfile(userProfile);
    }

    done(currentUser ? 'ok' : 'fail', { userId: currentUser?.id ?? null });
    return { session: currentSession, user: currentUser };
  };

  const signOut = async () => {
    logger.info(TAG, 'signOut', { userId: user?.id ?? null });
    if (user?.id) {
      try {
        await SecureStore.deleteItemAsync(`wizard_progress_v2_${user.id}`);
      } catch (e) {
        console.error('Failed to clear wizard progress on logout:', e);
      }
    }
    try {
      await supabaseSignOut();
    } catch (e) {
      console.warn('supabaseSignOut warning on logout:', e);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        session,
        user,
        profile,
        loading,
        isCheckingProfile,
        profileFetchError,
        signInWithPhone,
        verifyOTP,
        signOut,
        refreshProfile,
      },
    },
    children,
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
