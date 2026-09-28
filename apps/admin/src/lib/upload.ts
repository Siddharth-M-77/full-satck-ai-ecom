import { adminFetch } from './api';

export type UploadedImage = { url: string; publicId: string };

const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads straight from the browser to Cloudinary using a short-lived signature from the API. */
export async function uploadProductImage(file: File): Promise<UploadedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > MAX_BYTES) throw new Error('Image must be 5 MB or smaller.');

  const { data } = await adminFetch('/admin/uploads/signature');
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', data.apiKey);
  form.append('timestamp', String(data.timestamp));
  form.append('folder', data.folder);
  form.append('signature', data.signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${data.cloudName}/image/upload`, { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message || 'Image upload failed');
  return { url: body.secure_url, publicId: body.public_id };
}
