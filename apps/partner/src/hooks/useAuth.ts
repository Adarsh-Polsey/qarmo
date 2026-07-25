import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  supabase,
  signInWithPhone as supabaseSignIn,
  verifyOTP as supabaseVerify,
  signOut as supabaseSignOut,
  getSession as supabaseGetSession,
  Session,
  User,
} from '@qarmo/supabase';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_COUNTRY_CODE } from '@qarmo/core';

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
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isCheckingProfile: boolean;
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

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      setIsCheckingProfile(true);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (error) {
        console.warn('Profile fetch warning/error:', error.message);
        return null;
      }
      return data as UserProfile;
    } catch (e) {
      console.error('Failed to fetch profile:', e);
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
    supabaseGetSession()
      .then(async (activeSession) => {
        setSession(activeSession);
        const currentUser = activeSession?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const userProfile = await fetchProfile(currentUser.id);
          setProfile(userProfile);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error getting initial session:', err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const userProfile = await fetchProfile(currentUser.id);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPhone = async (phone: string) => {
    return await supabaseSignIn(phone);
  };

  const verifyOTP = async (phone: string, token: string) => {
    const data = await supabaseVerify(phone, token);
    const currentUser = data.user ?? null;
    const currentSession = data.session ?? null;

    setSession(currentSession);
    setUser(currentUser);

    if (currentUser) {
      const userProfile = await fetchProfile(currentUser.id);
      setProfile(userProfile);
    }

    return { session: currentSession, user: currentUser };
  };

  const signOut = async () => {
    if (user?.id) {
      try {
        await SecureStore.deleteItemAsync(`@wizard_progress_${user.id}`);
      } catch (e) {
        console.error('Failed to clear wizard progress on logout:', e);
      }
    }
    await supabaseSignOut();
    setSession(null);
    setUser(null);
    setProfile(null);
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
