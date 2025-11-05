'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import SelectDialog from '@/components/Modals/SelectDialog';

interface SelectOption {
  id: string;
  label: string;
}

interface SelectOptions {
  title: string;
  message: string | React.ReactNode;
  options: SelectOption[];
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

interface SelectDialogContextType {
  select: (options: SelectOptions) => Promise<string | null>;
}

const SelectDialogContext = createContext<SelectDialogContextType | undefined>(undefined);

export function SelectDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<SelectOptions>({
    title: '',
    message: '',
    options: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  let resolveSelect: ((value: string | null) => void) | null = null;

  const select = (opts: SelectOptions) => {
    return new Promise<string | null>((resolve) => {
      resolveSelect = resolve;
      setOptions(opts);
      setIsOpen(true);
      setIsLoading(false);
    });
  };

  const handleConfirm = (value: string) => {
    setIsLoading(true);
    if (resolveSelect) {
      resolveSelect(value);
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (resolveSelect) {
      resolveSelect(null);
    }
    setIsOpen(false);
  };

  return (
    <SelectDialogContext.Provider value={{ select }}>
      {children}
      <SelectDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        options={options.options}
        defaultValue={options.defaultValue}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        isDangerous={options.isDangerous}
        isLoading={isLoading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </SelectDialogContext.Provider>
  );
}

export function useSelectDialog() {
  const context = useContext(SelectDialogContext);
  if (!context) {
    throw new Error('useSelectDialog must be used within SelectDialogProvider');
  }
  return context;
}
