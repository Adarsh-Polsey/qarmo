import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@qarmo/supabase';
import { useAuth } from './useAuth';
import { logger } from '../utils/logger';

const TAG = 'Location';

export const usePartnerLocation = () => {
  const { profile } = useAuth();
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    // Only capture location if user is a partner and profile is complete
    if (!profile || profile.account_type !== 'partner' || !profile.profile_completed_at) return;

    const captureLocation = async () => {
      const done = logger.time(TAG, 'captureLocation');
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError(true);
          done('fail', { reason: 'permission not granted' });
          return;
        }

        setLocationError(false);
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

        // Write to profiles.last_location via direct update
        const { error } = await supabase.from('profiles').update({
          last_location: `POINT(${loc.coords.longitude} ${loc.coords.latitude})`,
          location_updated_at: new Date().toISOString(),
        }).eq('id', profile.id);

        if (error) {
          // Previously unchecked — a failed write here looked identical to a
          // successful one from the outside (map showing no pin, no error anywhere).
          logger.warn(TAG, 'Failed to write last_location to profiles', { message: error.message });
          setLocationError(true);
          done('fail', { message: error.message });
          return;
        }

        done('ok');
      } catch (e: any) {
        console.warn('Location capture error:', e);
        setLocationError(true);
        done('fail', { message: e?.message });
      }
    };

    // Capture on cold start
    captureLocation();

    // Capture on foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        captureLocation();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [profile]);

  return { locationError };
};
