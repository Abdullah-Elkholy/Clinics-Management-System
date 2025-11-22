'use client';

import { createContext, useContext, useState, useRef, ReactNode } from 'react';
import ConfirmationDialog from '@/components/Modals/ConfirmationDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

interface ConfirmationContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const resolveConfirmRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = (opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveConfirmRef.current = resolve;
      setOptions(opts);
      setIsOpen(true);
      setIsLoading(false);
    });
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      // Resolve the promise first to allow async operations to proceed
      if (resolveConfirmRef.current) {
        resolveConfirmRef.current(true);
        resolveConfirmRef.current = null;
      }
      // Keep dialog open briefly to show loading state, then close
      // This prevents flickering if the async operation completes quickly
      await new Promise(resolve => setTimeout(resolve, 100));
    } finally {
      setIsOpen(false);
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (resolveConfirmRef.current) {
      resolveConfirmRef.current(false);
      resolveConfirmRef.current = null;
    }
    setIsOpen(false);
  };

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      <ConfirmationDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        isDangerous={options.isDangerous}
        isLoading={isLoading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmationContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmationProvider');
  }
  return context;
}
