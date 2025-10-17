import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Layout from '../components/Layout';

describe('Layout Component', () => {
  const defaultProps = {
    userRole: 'مدير أساسي',
    userName: 'أحمد',
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
    canAddQueue: true,
    onAddQueue: jest.fn(),
    onEditQueue: jest.fn(),
    onDeleteQueue: jest.fn()
  };

  test('renders all major components', () => {
    render(
      <Layout {...defaultProps}>
        <div data-testid="test-content">محتوى تجريبي</div>
      </Layout>
    );

    // Check for Header content
    expect(screen.getByText('نظام إدارة العيادات')).toBeInTheDocument();
    expect(screen.getByText('أحمد')).toBeInTheDocument();
    
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
    const { rerender } = render(<Layout {...defaultProps} />);
    expect(screen.getByText('واتساب متصل')).toBeInTheDocument();

    rerender(<Layout {...defaultProps} whatsappConnected={false} />);
    expect(screen.queryByText('واتساب متصل')).not.toBeInTheDocument();
  });

  test('propagates queue actions to QueueList', () => {
    render(<Layout {...defaultProps} />);

    // Test queue selection
    const queueButton = screen.getByText('طابور الثاني');
    fireEvent.click(queueButton);
    expect(defaultProps.onQueueSelect).toHaveBeenCalledWith('q2');

    // Test queue editing
    const editButton = screen.getByLabelText('تعديل طابور طابور الأول');
    fireEvent.click(editButton);
    expect(defaultProps.onEditQueue).toHaveBeenCalledWith('q1');

    // Test queue deletion
    const deleteButton = screen.getByLabelText('حذف طابور طابور الأول');
    fireEvent.click(deleteButton);
    expect(defaultProps.onDeleteQueue).toHaveBeenCalledWith('q1');
  });

  test('propagates navigation actions', () => {
    render(<Layout {...defaultProps} />);

    const adminButton = screen.getByText('الإدارة');
    fireEvent.click(adminButton);
    expect(defaultProps.onSectionChange).toHaveBeenCalledWith('management');
  });

  test('handles logout action', () => {
    render(<Layout {...defaultProps} />);

    const logoutButton = screen.getByLabelText('تسجيل الخروج');
    fireEvent.click(logoutButton);
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });

  test('uses proper semantic HTML structure', () => {
    const { container } = render(<Layout {...defaultProps} />);

    expect(container.querySelector('header')).toBeInTheDocument();
    expect(container.querySelector('aside')).toBeInTheDocument();
    expect(container.querySelector('main')).toBeInTheDocument();
    expect(container.querySelector('nav')).toBeInTheDocument();

    expect(container.querySelector('aside')).toHaveAttribute('aria-label', 'القائمة الجانبية');
    expect(container.querySelector('main')).toHaveAttribute('role', 'main');
  });

  test('applies RTL layout', () => {
    const { container } = render(<Layout {...defaultProps} />);
    expect(container.firstChild).toHaveAttribute('dir', 'rtl');
  });
});