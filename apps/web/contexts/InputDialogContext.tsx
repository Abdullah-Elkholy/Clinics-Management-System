'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import InputDialog from '@/components/Modals/InputDialog';

interface InputOptions {
  title: string;
  message: string | React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  inputType?: 'text' | 'number' | 'email' | 'password';
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

interface InputDialogContextType {
  prompt: (options: InputOptions) => Promise<string | null>;
}

const InputDialogContext = createContext<InputDialogContextType | undefined>(undefined);

export function InputDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<InputOptions>({
    title: '',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  let resolvePrompt: ((value: string | null) => void) | null = null;

  const prompt = (opts: InputOptions) => {
    return new Promise<string | null>((resolve) => {
      resolvePrompt = resolve;
      setOptions(opts);
      setIsOpen(true);
      setIsLoading(false);
    });
  };

  const handleConfirm = (value: string) => {
    setIsLoading(true);
    if (resolvePrompt) {
      resolvePrompt(value);
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (resolvePrompt) {
      resolvePrompt(null);
    }
    setIsOpen(false);
  };

  return (
    <InputDialogContext.Provider value={{ prompt }}>
      {children}
      <InputDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        placeholder={options.placeholder}
        defaultValue={options.defaultValue}
        inputType={options.inputType}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        isDangerous={options.isDangerous}
        isLoading={isLoading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </InputDialogContext.Provider>
  );
}

export function useInputDialog() {
  const context = useContext(InputDialogContext);
  if (!context) {
    throw new Error('useInputDialog must be used within InputDialogProvider');
  }
  return context;
}
