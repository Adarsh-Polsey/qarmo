import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

/**
 * Compresses an image at `uri` to be safely under 500KB across Native and Web.
 * Resizes image dimensions and applies JPEG compression.
 */
export const compressImage = async (
  uri: string,
  maxWidth: number = 1000,
  quality: number = 0.75,
): Promise<string> => {
  let currentUri = uri;
  try {
    // Initial resize & compression pass (works on Web, iOS, Android)
    const manipResult = await manipulateAsync(
      currentUri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format: SaveFormat.JPEG }
    );
    currentUri = manipResult.uri;

    // Check size on native platforms if FileSystem is available
    try {
      const fileInfo = await FileSystem.getInfoAsync(currentUri);
      if (fileInfo.exists && typeof fileInfo.size === 'number') {
        let size = fileInfo.size;
        const maxSizeBytes = 500 * 1024;
        let currentQuality = quality;
        let currentWidth = maxWidth;

        while (size > maxSizeBytes && currentQuality > 0.2) {
          currentQuality -= 0.15;
          currentWidth = Math.floor(currentWidth * 0.8);
          const nextManip = await manipulateAsync(
            currentUri,
            [{ resize: { width: currentWidth } }],
            { compress: currentQuality, format: SaveFormat.JPEG }
          );
          currentUri = nextManip.uri;
          const nextInfo = await FileSystem.getInfoAsync(currentUri);
          if (!nextInfo.exists || typeof nextInfo.size !== 'number') break;
          size = nextInfo.size;
        }
      }
    } catch {
      // Ignore FileSystem errors on web
    }
  } catch (error) {
    console.error('Error compressing image:', error);
  }

  return currentUri;
};

/**
 * Reads a local file `uri` into a body suitable for `supabase.storage...upload()`.
 *
 * On native, `fetch(uri).then(r => r.blob())` for a local file is a known source of
 * "Network request failed" on Android — the failure is in RN's blob bridge reading the
 * local file, not in any actual network call. Reading the file as base64 and decoding
 * to an ArrayBuffer bypasses that bridge entirely (this is Supabase's own documented
 * pattern for React Native uploads). On web, `uri` is a blob:/data: URL that fetch
 * already handles natively, so there's no bridge to work around.
 */
export const uriToUploadBody = async (uri: string): Promise<Blob | ArrayBuffer> => {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return await response.blob();
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return decode(base64);
};
