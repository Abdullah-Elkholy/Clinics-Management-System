import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../components/Header';

describe('Header Component', () => {
  const defaultProps = {
    userRole: 'مدير أساسي',
    userName: 'أحمد',
    whatsappConnected: true,
    onLogout: jest.fn()
  };

  test('renders all required elements', () => {
    render(<Header {...defaultProps} />);
    
    // Check for clinic name
    expect(screen.getByText('نظام إدارة العيادات')).toBeInTheDocument();
    
    // Check for user role and name
    expect(screen.getAllByText('مدير أساسي')[0]).toBeInTheDocument();
    expect(screen.getByText('أحمد')).toBeInTheDocument();
    
    // Check for WhatsApp status
    expect(screen.getByText('واتساب متصل')).toBeInTheDocument();
    
    // Check for logout button
    expect(screen.getByLabelText('تسجيل الخروج')).toBeInTheDocument();
  });

  test('handles WhatsApp status changes', () => {
    const { rerender } = render(<Header {...defaultProps} />);
    expect(screen.getByText('واتساب متصل')).toBeInTheDocument();

    // Test disconnected state
    rerender(<Header {...defaultProps} whatsappConnected={false} />);
    expect(screen.queryByText('واتساب متصل')).not.toBeInTheDocument();
  });

  test('calls logout handler when logout button is clicked', () => {
    render(<Header {...defaultProps} />);
    const logoutButton = screen.getByLabelText('تسجيل الخروج');
    
    fireEvent.click(logoutButton);
    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
  });

  test('renders correctly with RTL layout', () => {
    const { container } = render(<Header {...defaultProps} />);
    
    // Check for RTL-specific classes
    expect(container.querySelector('.space-x-reverse')).toBeInTheDocument();
  });
});