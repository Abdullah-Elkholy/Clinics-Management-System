'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
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
  let resolveConfirm: ((value: boolean) => void) | null = null;

  const confirm = (opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveConfirm = resolve;
      setOptions(opts);
      setIsOpen(true);
      setIsLoading(false);
    });
  };

  const handleConfirm = () => {
    setIsLoading(true);
    if (resolveConfirm) {
      resolveConfirm(true);
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (resolveConfirm) {
      resolveConfirm(false);
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
