import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@qarmo/supabase';
import { useAuth } from './useAuth';

export const usePartnerLocation = () => {
  const { profile } = useAuth();
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    // Only capture location if user is a partner and profile is complete
    if (!profile || profile.account_type !== 'partner' || !profile.profile_completed_at) return;

    const captureLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError(true);
          return;
        }

        setLocationError(false);
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        
        // Write to profiles.last_location via direct update
        await supabase.from('profiles').update({
          last_location: `POINT(${loc.coords.longitude} ${loc.coords.latitude})`,
          location_updated_at: new Date().toISOString(),
        }).eq('id', profile.id);
        
      } catch (e) {
        console.warn('Location capture error:', e);
        setLocationError(true);
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
