import React from 'react'
import { MinimalDashboard } from './test-utils/MinimalDashboard'
import { renderWithProviders } from '../test-utils/renderWithProviders'

test('renders minimal dashboard component with DOM debug', () => {
  const { container } = renderWithProviders(<MinimalDashboard />);
  // basic debug logs kept intentionally in case of future flakiness
  console.log('Container HTML:', container.innerHTML);
  console.log('document.body.innerHTML:', document.body.innerHTML);
  expect(container.querySelector('[data-testid="minimal-dashboard"]')).not.toBeNull();
  expect(container.textContent).toContain('Minimal Dashboard Test');
});
