import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QueueList from '../components/QueueList';

describe('QueueList Component', () => {
  const defaultProps = {
    queues: [
      { id: 'q1', name: 'طابور الأول', patientCount: 5 },
      { id: 'q2', name: 'طابور الثاني', description: 'وصف الطابور', patientCount: 3 }
    ],
    selectedQueue: 'q1',
    onSelect: jest.fn(),
    canAddQueue: true,
    onAddQueue: jest.fn(),
    onEditQueue: jest.fn(),
    onDeleteQueue: jest.fn()
  };

  test('renders all queues with their details', () => {
    render(<QueueList {...defaultProps} />);
    
    expect(screen.getByText('طابور الأول')).toBeInTheDocument();
    expect(screen.getByText('طابور الثاني')).toBeInTheDocument();
    expect(screen.getByText('5 مريض')).toBeInTheDocument();
    expect(screen.getByText('وصف الطابور')).toBeInTheDocument();
  });

  test('shows queue count in header', () => {
    render(<QueueList {...defaultProps} />);
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  test('marks selected queue correctly', () => {
    render(<QueueList {...defaultProps} />);
    
    const firstQueueBtn = screen.getByLabelText('طابور طابور الأول');
    const secondQueueBtn = screen.getByLabelText('طابور طابور الثاني');
    
    expect(firstQueueBtn).toHaveAttribute('aria-pressed', 'true');
    expect(secondQueueBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('calls onSelect when clicking a queue', () => {
    render(<QueueList {...defaultProps} />);
    
    const secondQueueBtn = screen.getByLabelText('طابور طابور الثاني');
    fireEvent.click(secondQueueBtn);
    
    expect(defaultProps.onSelect).toHaveBeenCalledWith('q2');
  });

  test('renders add button when canAddQueue is true', () => {
    render(<QueueList {...defaultProps} />);
    
    const addButton = screen.getByLabelText('إضافة طابور');
    expect(addButton).toBeInTheDocument();
    
    fireEvent.click(addButton);
    expect(defaultProps.onAddQueue).toHaveBeenCalled();
  });

  test('hides add button when canAddQueue is false', () => {
    render(<QueueList {...defaultProps} canAddQueue={false} />);
    expect(screen.queryByLabelText('إضافة طابور')).not.toBeInTheDocument();
  });

  test('shows edit and delete controls', () => {
    render(<QueueList {...defaultProps} />);
    
    const editBtn = screen.getByLabelText('تعديل طابور طابور الأول');
    const deleteBtn = screen.getByLabelText('حذف طابور طابور الأول');
    
    fireEvent.click(editBtn);
    expect(defaultProps.onEditQueue).toHaveBeenCalledWith('q1');
    
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDeleteQueue).toHaveBeenCalledWith('q1');
  });

  test('has proper accessibility attributes', () => {
    const { container } = render(<QueueList {...defaultProps} />);
    
    expect(container.querySelector('[role="list"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(6); // 1 add icon + 1 check icon + 2 queues × (1 edit + 1 delete)
  });
});