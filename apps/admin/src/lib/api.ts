const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export async function adminFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('shopsense_admin_token');

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Admin API request failed');
  }

  return data;
}

export async function adminDownload(endpoint: string, filename: string) {
  const token = localStorage.getItem('shopsense_admin_token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Download failed');
  }

  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
