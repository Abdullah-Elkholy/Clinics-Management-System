import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Navigation from '../components/Navigation';

describe('Navigation Component', () => {
  const defaultProps = {
    activeSection: 'messages',
    onSectionChange: jest.fn()
  };

  test('renders all navigation items', () => {
    render(<Navigation {...defaultProps} />);
    
    expect(screen.getByText('الرسائل')).toBeInTheDocument();
    expect(screen.getByText('الإدارة')).toBeInTheDocument();
  });

  test('marks active section correctly', () => {
    render(<Navigation {...defaultProps} />);
    
    const messagesButton = screen.getByLabelText('قسم الرسائل');
    const adminButton = screen.getByLabelText('قسم الإدارة');
    
    expect(messagesButton).toHaveAttribute('aria-current', 'page');
    expect(adminButton).not.toHaveAttribute('aria-current', 'page');
  });

  test('calls onSectionChange when clicking navigation items', () => {
    render(<Navigation {...defaultProps} />);
    
    const adminButton = screen.getByLabelText('قسم الإدارة');
    fireEvent.click(adminButton);
    
    expect(defaultProps.onSectionChange).toHaveBeenCalledWith('management');
  });

  test('has proper accessibility attributes', () => {
    const { container } = render(<Navigation {...defaultProps} />);
    
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'التنقل الرئيسي');
    expect(container.querySelector('ul')).toHaveAttribute('role', 'list');
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2); // Icons
  });

  test('updates active section when prop changes', () => {
    const { rerender } = render(<Navigation {...defaultProps} />);
    
    expect(screen.getByLabelText('قسم الرسائل')).toHaveAttribute('aria-current', 'page');
    
    rerender(<Navigation {...defaultProps} activeSection="management" />);
    
    expect(screen.getByLabelText('قسم الرسائل')).not.toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('قسم الإدارة')).toHaveAttribute('aria-current', 'page');
  });
});