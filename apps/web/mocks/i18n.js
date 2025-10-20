import React from 'react';

const mockI18n = {
  t: (key, defaultText) => defaultText || key,
  setLocale: jest.fn(),
  getLocale: () => 'ar',
  getDir: () => 'rtl',
  initLocaleFromBrowser: jest.fn(),
};

export const useI18n = () => mockI18n;

export default mockI18n;
