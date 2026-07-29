import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@qarmo/supabase';
import { useAuth } from './useAuth';
import { logger } from '../utils/logger';

const TAG = 'Location';

// A partner's position for the map doesn't need sub-minute freshness — don't
// capture more than once per this window regardless of what triggers it.
const MIN_CAPTURE_INTERVAL_MS = 30_000;

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

  // Refs persist across re-renders so these guards survive without re-running the effect.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isCapturingRef = useRef(false);
  const lastCaptureAtRef = useRef(0);

  useEffect(() => {
    // Only capture location if user is a partner and profile is complete
    if (!partnerId || accountType !== 'partner' || !profileCompletedAt) return;

    const captureLocation = async () => {
      // Overlap + rate guards. AppState can emit 'active' rapidly (window-focus
      // churn, dev overlay, emulator), which previously fired captureLocation back
      // to back — dozens per second. Skip if one is already in flight or if we
      // captured within the throttle window.
      if (isCapturingRef.current) return;
      if (Date.now() - lastCaptureAtRef.current < MIN_CAPTURE_INTERVAL_MS) return;
      isCapturingRef.current = true;
      lastCaptureAtRef.current = Date.now();

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
      } finally {
        isCapturingRef.current = false;
      }
    };

    // Capture on cold start
    captureLocation();

    // Capture only on a real background/inactive -> active transition — not on
    // every 'active' event. AppState emits 'active' on transient focus changes
    // while already foregrounded; firing on those spammed captureLocation.
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const cameFromBackground = /inactive|background/.test(appStateRef.current);
      appStateRef.current = nextAppState;
      if (cameFromBackground && nextAppState === 'active') {
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
