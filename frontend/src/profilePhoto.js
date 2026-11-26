const PROFILE_PHOTO_MAX_BYTES = 500000;

export const compressProfilePhoto = async (file) => {
  let bitmap = null;
  let fallbackImage = null;
  let fallbackObjectUrl = null;

  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(file);
    } catch (error) {
      console.warn('Browser bitmap decoding failed; trying image-element decoding:', error);
    }
  }

  if (!bitmap) {
    fallbackObjectUrl = URL.createObjectURL(file);
    fallbackImage = new Image();
    try {
      await new Promise((resolve, reject) => {
        fallbackImage.onload = resolve;
        fallbackImage.onerror = () => reject(new Error('This image format could not be decoded by the browser.'));
        fallbackImage.src = fallbackObjectUrl;
      });
    } catch (error) {
      URL.revokeObjectURL(fallbackObjectUrl);
      throw error;
    }
  }

  const image = bitmap || fallbackImage;
  try {
    const imageWidth = image.width || image.naturalWidth;
    const imageHeight = image.height || image.naturalHeight;
    if (!imageWidth || !imageHeight) throw new Error('This profile photo has invalid dimensions.');

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare this profile photo.');

    const toJpegBlob = quality => new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode this profile photo.'));
      }, 'image/jpeg', quality);
    });

    let scale = Math.min(1, 1200 / Math.max(imageWidth, imageHeight));
    let blob = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = Math.max(1, Math.round(imageWidth * scale));
      canvas.height = Math.max(1, Math.round(imageHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (let quality = 0.82; quality >= 0.42; quality -= 0.1) {
        blob = await toJpegBlob(quality);
        if (blob.size <= PROFILE_PHOTO_MAX_BYTES) break;
      }
      if (blob.size <= PROFILE_PHOTO_MAX_BYTES) break;
      scale *= 0.85;
    }
    if (!blob || blob.size > PROFILE_PHOTO_MAX_BYTES) {
      throw new Error('Could not compress this photo enough. Please choose a smaller image.');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Could not read the compressed profile photo.'));
      reader.readAsDataURL(blob);
    });
  } finally {
    bitmap?.close();
    if (fallbackObjectUrl) URL.revokeObjectURL(fallbackObjectUrl);
  }
};
