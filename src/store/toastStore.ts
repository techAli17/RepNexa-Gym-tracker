import { t, translateError } from '../i18n';
import { create } from 'zustand';
import { isDomainError } from '../domain/errors';

interface ToastState {
  message: string | null;
  id: number;
  show(message: string): void;
  hide(): void;
}

export const useToastStore = create<ToastState>()(set => ({
  message: null,
  id: 0,
  show: message => set(s => ({ message, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));

export const toast = (message: string) => useToastStore.getState().show(message);

/**
 * Shows expected domain errors as their message. Anything else is unexpected:
 * it is logged, and the user gets a generic message rather than internals.
 */
export function toastError(e: unknown) {
  if (isDomainError(e)) {
    toast(translateError(e));
    return;
  }
  console.error(e);
  toast(t('common.unexpectedError'));
}
