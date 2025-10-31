'use client';

import React, { createContext, useContext, useState } from 'react';

export type ModalType = 
  | 'addQueue' 
  | 'addPatient' 
  | 'upload' 
  | 'messageSelection' 
  | 'messagePreview' 
  | 'addTemplate' 
  | 'editTemplate'
  | 'accountInfo' 
  | 'whatsappAuth' 
  | 'editQueue' 
  | 'editUser'
  | 'addUser'
  | 'retryPreview' 
  | 'quotaManagement'
  | 'editPatient'
  | 'messageConditions'
  | 'manageConditions'
  | 'templateEditor';

export interface ModalData {
  [key: string]: any;
}

interface ModalContextType {
  openModals: Set<ModalType>;
  openModal: (modal: ModalType, data?: ModalData) => void;
  closeModal: (modal: ModalType) => void;
  closeAllModals: () => void;
  getModalData: (modal: ModalType) => ModalData | undefined;
  setModalData: (modal: ModalType, data: ModalData) => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

interface ModalState {
  [key: string]: ModalData | undefined;
}

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openModals, setOpenModals] = useState<Set<ModalType>>(new Set());
  const [modalData, setModalDataState] = useState<ModalState>({});

  const openModal = (modal: ModalType, data?: ModalData) => {
    setOpenModals((prev) => new Set(prev).add(modal));
    if (data) {
      setModalDataState((prev) => ({
        ...prev,
        [modal]: data,
      }));
    }
  };

  const closeModal = (modal: ModalType) => {
    setOpenModals((prev) => {
      const newSet = new Set(prev);
      newSet.delete(modal);
      return newSet;
    });
    // Clear data when modal is closed
    setModalDataState((prev) => ({
      ...prev,
      [modal]: undefined,
    }));
  };

  const closeAllModals = () => {
    setOpenModals(new Set());
    setModalDataState({});
  };

  const getModalData = (modal: ModalType): ModalData | undefined => {
    return modalData[modal];
  };

  const setModalData = (modal: ModalType, data: ModalData) => {
    setModalDataState((prev) => ({
      ...prev,
      [modal]: data,
    }));
  };

  return (
    <ModalContext.Provider
      value={{
        openModals,
        openModal,
        closeModal,
        closeAllModals,
        getModalData,
        setModalData,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};
