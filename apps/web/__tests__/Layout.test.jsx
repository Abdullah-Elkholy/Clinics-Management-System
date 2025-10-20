import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Layout from '../components/Layout';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { ROLES } from '../lib/roles';
import { useAuthorization } from '../lib/authorization';

jest.mock('../lib/authorization', () => ({
  useAuthorization: jest.fn(),
}));

describe('Layout Component', () => {
  const mockUser = { name: 'أحمد', role: ROLES.PRIMARY_ADMIN };
  const defaultProps = {
    children: <div data-testid="test-content">محتوى تجريبي</div>,
    whatsappConnected: true,
    onLogout: jest.fn(),
    activeSection: 'messages',
    onSectionChange: jest.fn(),
    queues: [
      { id: 'q1', name: 'طابور الأول', patientCount: 5 },
      { id: 'q2', name: 'طابور الثاني', description: 'وصف الطابور', patientCount: 3 }
    ],
    selectedQueue: 'q1',
    onQueueSelect: jest.fn(),
    onAddQueue: jest.fn(),
    onEditQueue: jest.fn(),
    onDeleteQueue: jest.fn()
  };

  beforeEach(() => {
    useAuthorization.mockReturnValue({
  role: ROLES.PRIMARY_ADMIN,
      canSeeManagement: true,
      canAddQueue: true,
    });
  });

  test('renders all major components', () => {
    renderWithProviders(
      <Layout {...defaultProps} />,
      { auth: { user: mockUser, isAuthenticated: true } }
    );

    // Check for Header content
    expect(screen.getByText('نظام إدارة العيادات')).toBeInTheDocument();
    expect(screen.getByText(mockUser.name)).toBeInTheDocument();
    
    // Check for Navigation content
    expect(screen.getByText('الرسائل')).toBeInTheDocument();
    expect(screen.getByText('الإدارة')).toBeInTheDocument();
    
    // Check for QueueList content
    expect(screen.getByText('طابور الأول')).toBeInTheDocument();
    expect(screen.getByText('طابور الثاني')).toBeInTheDocument();
    
    // Check for main content
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  test('handles WhatsApp connection status', () => {
    const { rerender } = renderWithProviders(<Layout {...defaultProps} />, { auth: { user: mockUser, isAuthenticated: true } });
    expect(screen.getByText('واتساب متصل')).toBeInTheDocument();

    rerender(<Layout {...defaultProps} whatsappConnected={false} />);
    expect(screen.queryByText('واتساب متصل')).not.toBeInTheDocument();
  });

  test('propagates queue actions to QueueList', () => {
    renderWithProviders(<Layout {...defaultProps} />, { auth: { user: mockUser, isAuthenticated: true } });

    // Test queue selection
    const queueButton = screen.getByText('طابور الثاني');
    fireEvent.click(queueButton);
    expect(defaultProps.onQueueSelect).toHaveBeenCalledWith('q2');
  });

  test('propagates navigation actions', () => {
    renderWithProviders(<Layout {...defaultProps} />, { auth: { user: mockUser, isAuthenticated: true } });

    const adminButton = screen.getByText('الإدارة');
    fireEvent.click(adminButton);
    expect(defaultProps.onSectionChange).toHaveBeenCalledWith('management');
  });

  test('handles logout action', () => {
    renderWithProviders(<Layout {...defaultProps} />, { auth: { user: mockUser, isAuthenticated: true } });

    const logoutButton = screen.getByLabelText('تسجيل الخروج');
    fireEvent.click(logoutButton);
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });

  test('uses proper semantic HTML structure', () => {
    const { container } = renderWithProviders(<Layout {...defaultProps} />, { auth: { user: mockUser, isAuthenticated: true } });

    expect(container.querySelector('header')).toBeInTheDocument();
    expect(container.querySelector('aside')).toBeInTheDocument();
    expect(container.querySelector('main')).toBeInTheDocument();
    expect(container.querySelector('nav')).toBeInTheDocument();

    expect(container.querySelector('aside')).toHaveAttribute('aria-label', 'القائمة الجانبية');
    expect(container.querySelector('main')).toHaveAttribute('role', 'main');
  });

  test('applies RTL layout', () => {
    const { container } = renderWithProviders(<Layout {...defaultProps} />, { auth: { user: mockUser, isAuthenticated: true } });
    expect(container.firstChild).toHaveAttribute('dir', 'rtl');
  });
});