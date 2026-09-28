import { useAuthStore } from '../stores/auth.store';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // sends httpOnly refresh cookies
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'An unexpected error occurred');
  }

  return data;
}

export async function apiDownload(endpoint: string, filename: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || 'Invoice download failed');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
