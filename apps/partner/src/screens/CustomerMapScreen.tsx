import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Dimensions, Platform, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '@qarmo/supabase';
import { GlobalCounter } from '../components/GlobalCounter';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '../utils/logger';

const TAG = 'Map';

const KOCHI_REGION: Region = {
  latitude: 10.0158605,
  longitude: 76.3418666,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

interface PartnerPin {
  id: string;
  partner_type: string;
  lng: number;
  lat: number;
}

export const CustomerMapScreen: React.FC = () => {
  const { t } = useTranslation();
  const [initialRegion, setInitialRegion] = useState<Region>(KOCHI_REGION);
  const [locationDenied, setLocationDenied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [partners, setPartners] = useState<PartnerPin[]>([]);
  const [showZoomHint, setShowZoomHint] = useState(false);
  const mapRef = useRef<MapView>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchCounterRef = useRef(0);
  const rpcFailedRef = useRef(false); // stop retries if RPC missing

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationDenied(true);
          setInitialRegion(KOCHI_REGION);
          setIsReady(true);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setInitialRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch (err) {
        console.warn('Location error:', err);
        setLocationDenied(true);
        setInitialRegion(KOCHI_REGION);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const fetchPartnersInRegion = async (region: Region) => {
    if (rpcFailedRef.current) {
      logger.info(TAG, 'Skipping partners_in_bounds fetch — RPC already known unavailable this session');
      return;
    }
    const fetchId = ++fetchCounterRef.current;
    const min_lat = region.latitude - region.latitudeDelta / 2;
    const max_lat = region.latitude + region.latitudeDelta / 2;
    const min_lng = region.longitude - region.longitudeDelta / 2;
    const max_lng = region.longitude + region.longitudeDelta / 2;

    const done = logger.time(TAG, `fetchPartnersInRegion (fetchId=${fetchId})`);
    const { data, error } = await supabase.rpc('partners_in_bounds', {
      min_lng,
      min_lat,
      max_lng,
      max_lat,
    });

    if (fetchId !== fetchCounterRef.current) {
      logger.info(TAG, `fetchId=${fetchId} superseded by a newer region change — discarding result`);
      return;
    }

    if (error) {
      rpcFailedRef.current = true;
      console.warn('partners_in_bounds RPC unavailable:', error.message);
      done('fail', { message: error.message });
      return;
    }

    if (data) {
      setPartners(data as PartnerPin[]);
      setShowZoomHint(data.length >= 100);
      done('ok', { partnerCount: data.length });
    } else {
      done('ok', { partnerCount: 0 });
    }
  };

  const onRegionChangeComplete = useCallback((region: Region) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchPartnersInRegion(region);
    }, 400);
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="caption" color={theme.colors.mutedText} style={styles.loadingText}>
          {t('map.locating', { defaultValue: 'Finding your location...' })}
        </Text>
      </View>
    );
  }

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return (
    <View style={styles.container}>
      <GlobalCounter />
      
      {locationDenied && (
        <View style={styles.banner}>
          <Ionicons name="location-outline" size={20} color={theme.colors.ink} style={{ marginRight: 8 }} />
          <Text variant="caption" style={styles.bannerText}>
            {t('map.locationDenied', { defaultValue: 'Turn on location to see partners near you.' })}
          </Text>
          <TouchableOpacity onPress={openSettings}>
            <Text variant="caption" color={theme.colors.primary} style={styles.bannerAction}>
              {t('map.openSettings', { defaultValue: 'Open settings' })}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={!locationDenied}
        showsMyLocationButton={!locationDenied}
      >
        {partners.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            tracksViewChanges={false} // Performance optimization for simple icons
          >
            <View style={styles.markerContainer}>
              <Text style={styles.markerText}>{p.partner_type === 'delivery' ? '🛵' : '🛺'}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {showZoomHint && (
        <View style={styles.hintContainer}>
          <View style={styles.hintBubble}>
            <Text variant="caption" style={styles.hintText}>
              {t('map.zoomIn', { defaultValue: 'Zoom in to see more' })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.sm,
  },
  map: {
    flex: 1,
    width: Dimensions.get('window').width,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  bannerText: {
    flex: 1,
  },
  bannerAction: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
  },
  markerContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    fontSize: 24,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintBubble: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintText: {
    color: '#FFFFFF',
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
  },
});
