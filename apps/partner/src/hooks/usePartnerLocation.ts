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

  // Depend on the stable primitive fields, not the profile object itself.
  // setProfile() runs on every auth revalidation (INITIAL_SESSION, TOKEN_REFRESHED,
  // profile re-fetch), each time producing a new object reference with identical data.
  // Keying the effect on the object caused it to tear down and re-fire captureLocation()
  // on every one of those, stacking dozens of overlapping 15-30s location reads.
  const partnerId = profile?.id;
  const accountType = profile?.account_type;
  const profileCompletedAt = profile?.profile_completed_at;

  useEffect(() => {
    // Only capture location if user is a partner and profile is complete
    if (!partnerId || accountType !== 'partner' || !profileCompletedAt) return;

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
        // Prefer a recent cached fix over a fresh GPS lock — a cold Balanced read was
        // taking 15-30s. A partner's position for the map doesn't need sub-minute
        // freshness, so accept any cached fix up to 1 min old and only fall back to a
        // fresh read when the cache is empty/stale.
        const loc =
          (await Location.getLastKnownPositionAsync({ maxAge: 60000 })) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));

        // Write to profiles.last_location via direct update
        const { error } = await supabase.from('profiles').update({
          last_location: `POINT(${loc.coords.longitude} ${loc.coords.latitude})`,
          location_updated_at: new Date().toISOString(),
        }).eq('id', partnerId);

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
  }, [partnerId, accountType, profileCompletedAt]);

  return { locationError };
};
