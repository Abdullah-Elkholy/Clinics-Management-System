import React from 'react';
import { render } from '@testing-library/react';
import { MinimalDashboard } from './test-utils/MinimalDashboard';

test('renders minimal dashboard div', () => {
  const { container } = render(<MinimalDashboard />);
  expect(container.querySelector('[data-testid="minimal-dashboard"]')).not.toBeNull();
  expect(container.textContent).toContain('Minimal Dashboard Test');
});
