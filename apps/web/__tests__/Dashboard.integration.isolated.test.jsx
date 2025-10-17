import React from 'react';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { MinimalDashboard } from './test-utils/MinimalDashboard';

test('renders minimal dashboard div with renderWithProviders', () => {
  const { container } = renderWithProviders(<MinimalDashboard />);
  expect(container.querySelector('[data-testid="minimal-dashboard"]')).not.toBeNull();
  expect(container.textContent).toContain('Minimal Dashboard Test');
});
