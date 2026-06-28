/**
 * Resizes an image file down to a max dimension and re-encodes it as JPEG
 * at the given quality, to drastically cut upload/storage/egress size.
 * Returns a new File object (same name) ready to pass to supabase upload.
 */
export async function resizeImage(file, { maxDimension = 800, quality = 0.8 } = {}) {
  const imageBitmap = await createImageBitmap(file);

  let { width, height } = imageBitmap;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );

  // Force .jpg extension since we're always re-encoding as JPEG now
  const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}