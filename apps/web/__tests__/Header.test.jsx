import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../components/Header';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { useAuthorization } from '../lib/authorization';
import { ROLES } from '../lib/roles';

jest.mock('../lib/authorization', () => ({
  useAuthorization: jest.fn(),
}));

describe('Header Component', () => {
  const mockUser = { name: 'أحمد', role: ROLES.PRIMARY_ADMIN };
  const defaultProps = {
    whatsappConnected: true,
    onLogout: jest.fn()
  };

  beforeEach(() => {
    useAuthorization.mockReturnValue({
      role: ROLES.PRIMARY_ADMIN,
    });
  });

  test('renders all required elements', () => {
    renderWithProviders(<Header {...defaultProps} />, { auth: { user: mockUser } });
    
    // Check for clinic name
    expect(screen.getByText('نظام إدارة العيادات')).toBeInTheDocument();
    
  // Check for user role and name
  expect(screen.getAllByText(ROLES.PRIMARY_ADMIN)[0]).toBeInTheDocument();
    expect(screen.getByText('أحمد')).toBeInTheDocument();
    
    // Check for WhatsApp status
    expect(screen.getByText('واتساب متصل')).toBeInTheDocument();
    
    // Check for logout button
    expect(screen.getByLabelText('تسجيل الخروج')).toBeInTheDocument();
  });

  test('handles WhatsApp status changes', () => {
    const { rerender } = renderWithProviders(<Header {...defaultProps} />, { auth: { user: mockUser } });
    expect(screen.getByText('واتساب متصل')).toBeInTheDocument();

    // Test disconnected state
    rerender(<Header {...defaultProps} whatsappConnected={false} />);
    expect(screen.queryByText('واتساب متصل')).not.toBeInTheDocument();
  });

  test('calls logout handler when logout button is clicked', () => {
    renderWithProviders(<Header {...defaultProps} />, { auth: { user: mockUser } });
    const logoutButton = screen.getByLabelText('تسجيل الخروج');
    
    fireEvent.click(logoutButton);
    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
  });

  test('renders correctly with RTL layout', () => {
    const { container } = renderWithProviders(<Header {...defaultProps} />, { auth: { user: mockUser } });
    
    // Check for RTL-specific classes
    expect(container.querySelector('.space-x-reverse')).toBeInTheDocument();
  });
});