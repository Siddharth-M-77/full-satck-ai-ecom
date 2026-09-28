import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';
export type Toast = { id: number; tone: ToastTone; title: string; description?: string; action?: { label: string; href: string } };

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    // Keep the stack short on phones; the newest message matters most.
    set({ toasts: [...get().toasts.slice(-2), { ...toast, id }] });
    window.setTimeout(() => get().dismiss(id), toast.tone === 'error' ? 6000 : 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
}));

export const toast = {
  success: (title: string, extra: Partial<Omit<Toast, 'id' | 'tone' | 'title'>> = {}) => useToastStore.getState().push({ tone: 'success', title, ...extra }),
  error: (title: string, extra: Partial<Omit<Toast, 'id' | 'tone' | 'title'>> = {}) => useToastStore.getState().push({ tone: 'error', title, ...extra }),
  info: (title: string, extra: Partial<Omit<Toast, 'id' | 'tone' | 'title'>> = {}) => useToastStore.getState().push({ tone: 'info', title, ...extra }),
};

export const errorMessage = (err: unknown, fallback = 'Something went wrong') => err instanceof Error ? err.message : fallback;
