// Ola Maps — vector tiles following the MapLibre Style Specification.
// Ola's own Android/iOS SDKs are themselves thin wrappers around MapLibre
// Native, so we talk to the same tile API directly via @maplibre/maplibre-react-native
// instead of taking on an unofficial, poorly-maintained RN binding.
//
// The style.json Ola returns references tile/sprite/glyph sub-resources that
// don't carry the API key themselves — every request under api.olamaps.io needs
// `api_key` appended, which is why this registers a global URL transform rather
// than just embedding the key in the top-level style URL.
import { TransformRequestManager } from '@maplibre/maplibre-react-native';

const OLA_MAPS_API_KEY = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY || '';

export const OLA_MAPS_STYLE_URL =
  'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json';

if (!OLA_MAPS_API_KEY) {
  console.warn('EXPO_PUBLIC_OLA_MAPS_API_KEY is not set — map tiles will fail to load.');
}

TransformRequestManager.addUrlSearchParam({
  id: 'ola-maps-api-key',
  match: /api\.olamaps\.io/,
  name: 'api_key',
  value: OLA_MAPS_API_KEY,
});
