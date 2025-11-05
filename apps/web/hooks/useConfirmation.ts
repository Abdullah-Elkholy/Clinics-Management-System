import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export function useConfirmation() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmOptions & { onConfirm: () => void | Promise<void>; onCancel: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });
  const [isLoading, setIsLoading] = useState(false);

  const confirm = useCallback(
    (options: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        setConfig({
          ...options,
          onConfirm: async () => {
            setIsLoading(true);
            try {
              resolve(true);
              setIsOpen(false);
            } finally {
              setIsLoading(false);
            }
          },
          onCancel: () => {
            resolve(false);
            setIsOpen(false);
          },
        });
        setIsOpen(true);
      });
    },
    []
  );

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    config,
    isLoading,
    confirm,
    closeDialog,
  };
}
