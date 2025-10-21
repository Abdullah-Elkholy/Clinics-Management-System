import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import QueueList from '../components/QueueList';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { useAuthorization } from '../lib/authorization';
import { ROLES } from '../lib/roles';

jest.mock('../lib/authorization', () => ({
  useAuthorization: jest.fn(() => ({
    canCreateQueues: true,
    canDeleteQueues: true,
    canEditQueues: true
  })),
}));

describe('QueueList Component', () => {
  const mockUser = { name: 'أحمد', role: ROLES.PRIMARY_ADMIN };
  const defaultProps = {
    queues: [
      { id: 'q1', name: 'طابور الأول', patientCount: 5 },
      { id: 'q2', name: 'طابور الثاني', description: 'وصف الطابور', patientCount: 3 }
    ],
    selectedQueue: 'q1',
    onSelect: jest.fn(),
    onAddQueue: jest.fn(),
    onEditQueue: jest.fn(),
    onDeleteQueue: jest.fn()
  };

  beforeEach(() => {
    useAuthorization.mockReturnValue({
      canCreateQueues: true,
      canEditQueues: true,
      canDeleteQueues: true,
    });
  });

  test('renders all queues with their details', () => {
    renderWithProviders(<QueueList {...defaultProps} />, { auth: { user: mockUser } });
    
    expect(screen.getByText('طابور الأول')).toBeInTheDocument();
    expect(screen.getByText('طابور الثاني')).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText('وصف الطابور')).toBeInTheDocument();
  });

  test('shows queue count in header', () => {
    renderWithProviders(<QueueList {...defaultProps} />, { auth: { user: mockUser } });
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  test('marks selected queue correctly', () => {
    renderWithProviders(<QueueList {...defaultProps} />, { auth: { user: mockUser } });
    
    const firstQueueBtn = screen.getByLabelText('طابور طابور الأول');
    const secondQueueBtn = screen.getByLabelText('طابور طابور الثاني');
    
    expect(firstQueueBtn).toHaveAttribute('aria-pressed', 'true');
    expect(secondQueueBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('calls onSelect when clicking a queue', () => {
    renderWithProviders(<QueueList {...defaultProps} />, { auth: { user: mockUser } });
    
    const secondQueueBtn = screen.getByLabelText('طابور طابور الثاني');
    fireEvent.click(secondQueueBtn);
    
    expect(defaultProps.onSelect).toHaveBeenCalledWith('q2');
  });

  test('renders add button when canAddQueue is true', () => {
    renderWithProviders(<QueueList {...defaultProps} />, { auth: { user: mockUser } });
    
    const addButton = screen.getByRole('button', { name: /إضافة طابور/i });
    expect(addButton).toBeInTheDocument();
    
    fireEvent.click(addButton);
    expect(defaultProps.onAddQueue).toHaveBeenCalled();
  });

  test('hides add button when canCreateQueues is false', () => {
    useAuthorization.mockReturnValue({
      canCreateQueues: false,
    });
    renderWithProviders(<QueueList {...defaultProps} />, { auth: { user: mockUser } });
    expect(screen.queryByRole('button', { name: /إضافة طابور/i })).not.toBeInTheDocument();
  });

  test('shows edit and delete controls', () => {
    renderWithProviders(<QueueList {...defaultProps} />, { auth: { user: mockUser } });
    
    // The buttons are only visible on hover, so we need to simulate that
    const firstQueueItem = screen.getByLabelText('طابور طابور الأول').closest('[role="listitem"]');
    fireEvent.mouseEnter(firstQueueItem);

    const editBtn = screen.getByLabelText('تعديل طابور طابور الأول');
    const deleteBtn = screen.getByLabelText('حذف طابور طابور الأول');
    
    fireEvent.click(editBtn);
    expect(defaultProps.onEditQueue).toHaveBeenCalledWith('q1');
    
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDeleteQueue).toHaveBeenCalledWith('q1');
  });

  test('has proper accessibility attributes', () => {
    const { container } = renderWithProviders(<QueueList {...defaultProps} />, { auth: { user: mockUser } });
    
    expect(container.querySelector('[role="list"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(2);
  });
});