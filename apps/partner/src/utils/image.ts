import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

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
