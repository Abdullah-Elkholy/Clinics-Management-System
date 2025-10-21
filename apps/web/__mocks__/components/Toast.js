import React from 'react';

function MockToast() {
  return <div data-testid="toast-mock"></div>;
}

// Export a mock showToast function
export const showToast = jest.fn();
export const enqueueToast = jest.fn();

export default MockToast;


