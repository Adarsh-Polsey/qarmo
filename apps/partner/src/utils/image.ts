import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Compresses an image at `uri` to be ≤ 500KB.
 * Iteratively decreases dimensions and quality if needed.
 */
export const compressImage = async (uri: string): Promise<string> => {
  let currentUri = uri;
  try {
    let fileInfo = await FileSystem.getInfoAsync(currentUri);
    if (!fileInfo.exists) return uri;

    let size = fileInfo.size;
    const maxSizeBytes = 500 * 1024;

    if (size <= maxSizeBytes) {
      return currentUri;
    }

    let quality = 0.8;
    let width = 1000;

    // Run until file size is <= 500KB or quality drops too low
    while (size > maxSizeBytes && quality > 0.1) {
      const manipResult = await manipulateAsync(
        currentUri,
        [{ resize: { width } }],
        { compress: quality, format: SaveFormat.JPEG }
      );

      currentUri = manipResult.uri;
      const newInfo = await FileSystem.getInfoAsync(currentUri);
      if (!newInfo.exists) break;
      size = newInfo.size;

      quality -= 0.15;
      width = Math.floor(width * 0.8);
    }
  } catch (error) {
    console.error('Error compressing image:', error);
  }

  return currentUri;
};
