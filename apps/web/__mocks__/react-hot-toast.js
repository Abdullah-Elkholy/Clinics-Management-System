import React from 'react';

const toast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

export const Toaster = () => <div data-testid="toaster-mock" />;

export default toast;
