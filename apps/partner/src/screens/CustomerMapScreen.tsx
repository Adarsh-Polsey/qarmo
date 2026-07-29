import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Platform, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, IconMapPin, IconScooter, IconTaxi } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import {
  Map,
  Camera,
  ViewAnnotation,
  UserLocation,
  type ViewStateChangeEvent,
  type LngLat,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { supabase } from '@qarmo/supabase';
import { GlobalCounter } from '../components/GlobalCounter';
import { logger } from '../utils/logger';
import { OLA_MAPS_STYLE_URL } from '../config/olaMaps';

const TAG = 'Map';

const KOCHI_CENTER: LngLat = [76.3418666, 10.0158605];
const DEFAULT_ZOOM = 12; // roughly matches the old 0.1° fallback region
const GPS_ZOOM = 14; // roughly matches the old 0.05° GPS-centered region

interface PartnerPin {
  id: string;
  partner_type: string;
  lng: number;
  lat: number;
}

export const CustomerMapScreen: React.FC = () => {
  const { t } = useTranslation();
  const [initialCenter, setInitialCenter] = useState<LngLat>(KOCHI_CENTER);
  const [initialZoom, setInitialZoom] = useState<number>(DEFAULT_ZOOM);
  const [locationDenied, setLocationDenied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [partners, setPartners] = useState<PartnerPin[]>([]);
  const [showZoomHint, setShowZoomHint] = useState(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchCounterRef = useRef(0);
  const rpcFailedRef = useRef(false); // stop retries if RPC missing

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationDenied(true);
          setInitialCenter(KOCHI_CENTER);
          setIsReady(true);
          return;
        }

        // Show the map immediately from a recent cached fix instead of blocking the
        // whole screen behind a cold GPS lock (a fresh Balanced read takes 15-30s).
        // Only fall back to a fresh read when there's nothing cached.
        const cached = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
        const loc = cached ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        setInitialCenter([loc.coords.longitude, loc.coords.latitude]);
        setInitialZoom(GPS_ZOOM);
      } catch (err) {
        console.warn('Location error:', err);
        setLocationDenied(true);
        setInitialCenter(KOCHI_CENTER);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const fetchPartnersInBounds = async ([min_lng, min_lat, max_lng, max_lat]: [number, number, number, number]) => {
    if (rpcFailedRef.current) {
      logger.info(TAG, 'Skipping partners_in_bounds fetch — RPC already known unavailable this session');
      return;
    }
    const fetchId = ++fetchCounterRef.current;

    const done = logger.time(TAG, `fetchPartnersInBounds (fetchId=${fetchId})`);
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

  const onRegionDidChange = useCallback((event: { nativeEvent: ViewStateChangeEvent }) => {
    const { bounds } = event.nativeEvent;
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchPartnersInBounds(bounds);
    }, 400);
  }, []);

  if (!isReady) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="caption" color={theme.colors.mutedText} style={styles.loadingText}>
          {t('map.locating', { defaultValue: 'Finding your location...' })}
        </Text>
      </SafeAreaView>
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
    <SafeAreaView edges={['top']} style={styles.container}>
      <GlobalCounter />

      {locationDenied && (
        <View style={styles.banner}>
          <IconMapPin size={20} color={theme.colors.ink} style={{ marginRight: 8 }} />
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

      <Map style={styles.map} mapStyle={OLA_MAPS_STYLE_URL} onRegionDidChange={onRegionDidChange}>
        <Camera initialViewState={{ center: initialCenter, zoom: initialZoom }} />

        {!locationDenied && <UserLocation />}

        {partners.map((p) => {
          // Color-code so ride vs delivery is distinguishable at a glance (both were
          // ink before): amber for ride/auto, green for delivery — both distinct from
          // the blue user-location puck. The circle keeps its soft-grey border; type
          // is conveyed by the icon color and the label tag below it.
          const isDelivery = p.partner_type === 'delivery';
          const typeColor = isDelivery ? theme.colors.success : theme.colors.primary;
          const label = isDelivery
            ? t('map.tagDelivery', { defaultValue: 'Delivery' })
            : t('map.tagRide', { defaultValue: 'Ride' });
          return (
            <ViewAnnotation key={p.id} id={p.id} lngLat={[p.lng, p.lat]}>
              <View style={styles.markerWrapper}>
                <View style={styles.markerContainer}>
                  {isDelivery ? (
                    <IconScooter size={18} color={typeColor} />
                  ) : (
                    <IconTaxi size={18} color={typeColor} />
                  )}
                </View>
                <View style={styles.markerTag}>
                  <Text variant="caption" style={[styles.markerTagText, { color: typeColor }]}>
                    {label}
                  </Text>
                </View>
              </View>
            </ViewAnnotation>
          );
        })}
      </Map>

      {showZoomHint && (
        <View style={styles.hintContainer}>
          <View style={styles.hintBubble}>
            <Text variant="caption" style={styles.hintText}>
              {t('map.zoomIn', { defaultValue: 'Zoom in to see more' })}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
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
  markerWrapper: {
    // Column so the type tag sits under the circle; the geo point lands at the
    // circle's base, which reads like the marker "standing" on the location.
    alignItems: 'center',
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  markerTag: {
    marginTop: 3,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  markerTagText: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    fontSize: 10,
    lineHeight: 14,
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
