import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Navigation from '../components/Navigation';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { useAuthorization } from '../lib/authorization';
import { ROLES } from '../lib/roles';

jest.mock('../lib/authorization', () => ({
  useAuthorization: jest.fn(),
}));

describe('Navigation Component', () => {
  const mockUser = { name: 'أحمد', role: ROLES.PRIMARY_ADMIN };
  const defaultProps = {
    activeSection: 'messages',
    onSectionChange: jest.fn()
  };

  beforeEach(() => {
    useAuthorization.mockReturnValue({
      canSeeManagement: true,
    });
  });

  test('renders all navigation items', () => {
    renderWithProviders(<Navigation {...defaultProps} />, { auth: { user: mockUser } });
    
    expect(screen.getByText('الرسائل')).toBeInTheDocument();
    expect(screen.getByText('الإدارة')).toBeInTheDocument();
  });

  test('marks active section correctly', () => {
    renderWithProviders(<Navigation {...defaultProps} />, { auth: { user: mockUser } });
    
    const messagesButton = screen.getByLabelText('قسم الرسائل');
    const adminButton = screen.getByLabelText('قسم الإدارة');
    
    expect(messagesButton).toHaveAttribute('aria-current', 'page');
    expect(adminButton).not.toHaveAttribute('aria-current', 'page');
  });

  test('calls onSectionChange when clicking navigation items', () => {
    renderWithProviders(<Navigation {...defaultProps} />, { auth: { user: mockUser } });
    
    const adminButton = screen.getByLabelText('قسم الإدارة');
    fireEvent.click(adminButton);
    
    expect(defaultProps.onSectionChange).toHaveBeenCalledWith('management');
  });

  test('has proper accessibility attributes', () => {
    const { container } = renderWithProviders(<Navigation {...defaultProps} />, { auth: { user: mockUser } });
    
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'التنقل الرئيسي');
    expect(container.querySelector('ul')).toHaveAttribute('role', 'list');
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2); // Icons
  });

  test('updates active section when prop changes', () => {
    const { rerender } = renderWithProviders(<Navigation {...defaultProps} />, { auth: { user: mockUser } });
    
    expect(screen.getByLabelText('قسم الرسائل')).toHaveAttribute('aria-current', 'page');
    
    rerender(<Navigation {...defaultProps} activeSection="management" />);
    
    expect(screen.getByLabelText('قسم الرسائل')).not.toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('قسم الإدارة')).toHaveAttribute('aria-current', 'page');
  });
});