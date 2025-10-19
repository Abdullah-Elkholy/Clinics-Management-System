import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard from '../pages/dashboard';
import api from '../lib/api';

// Mock api module
jest.mock('../lib/api');

describe('Dashboard Component', () => {
  const mockQueues = [
    { id: 'q1', name: 'طابور الأول', currentPosition: 1, estimatedTime: 15 },
    { id: 'q2', name: 'طابور الثاني', currentPosition: 2, estimatedTime: 20 }
  ];

  const mockPatients = [
    { id: 'p1', fullName: 'أحمد محمد', phoneNumber: '123456789', position: 1 },
    { id: 'p2', fullName: 'محمد علي', phoneNumber: '987654321', position: 2 }
  ];

  const mockTemplates = [
    { id: 't1', content: 'مرحباً {{name}}، دورك رقم {{position}}' },
    { id: 't2', content: 'تم تأكيد موعدك' }
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default api responses
    api.get.mockImplementation((url) => {
      if (url === '/api/queues') return Promise.resolve({ data: { queues: mockQueues } });
      if (url === '/api/templates') return Promise.resolve({ data: { templates: mockTemplates } });
      if (url.includes('/patients')) return Promise.resolve({ data: { patients: mockPatients } });
      return Promise.reject(new Error('Not found'));
    });
  });

  test('renders initial dashboard state with queues list', async () => {
    render(<Dashboard />);

    // Wait for the queue to appear (ensures useEffect setState has completed)
    await screen.findByText('طابور الأول')

    // API should have been called for initial data
    expect(api.get).toHaveBeenCalledWith('/api/queues');
    expect(api.get).toHaveBeenCalledWith('/api/templates');

    // Verify queue list is rendered
    expect(screen.getByText('طابور الأول')).toBeInTheDocument();
    expect(screen.getByText('طابور الثاني')).toBeInTheDocument();
  });

  test('loads patient data when selecting a queue', async () => {
    render(<Dashboard />);
    // Wait for initial queues to load
    await screen.findByText('طابور الأول')

    // Click on first queue
    fireEvent.click(screen.getByText('طابور الأول'));

    // Wait for patients to load into the DOM
    await screen.findByText('أحمد محمد')

    // API should have been called to fetch patients
    expect(api.get).toHaveBeenCalledWith('/api/queues/q1/patients');

    // Verify patients are displayed
    expect(screen.getByText('أحمد محمد')).toBeInTheDocument();
    expect(screen.getByText('محمد علي')).toBeInTheDocument();
  });

  test('handles adding a new queue', async () => {
    const newQueue = { id: 'q3', title: 'طابور جديد', currentPosition: 1, estimatedTime: 10 };
    api.post.mockResolvedValueOnce({ data: { queue: newQueue } });

    render(<Dashboard />);

    // Wait for initial queues to load
    await screen.findByText('طابور الأول')

    // Simulate adding a new queue
    const addQueueButton = await screen.findByRole('button', { name: 'إضافة طابور' });
    fireEvent.click(addQueueButton);

    // Fill in queue details
    const nameInput = screen.getByLabelText('اسم الطابور');
    fireEvent.change(nameInput, { target: { value: 'طابور جديد' } });
    
    const submitButton = screen.getByRole('button', { name: 'إضافة' });
    fireEvent.click(submitButton);

    // Wait for the POST to be called and the new queue to appear
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/queues', {
      title: 'طابور جديد',
      description: ''
    }))

    await screen.findByText('طابور جديد')
  });

  test('handles patient actions (add, delete, message)', async () => {
    render(<Dashboard />);

    // Wait for queues then select one
    await screen.findByText('طابور الأول')
    fireEvent.click(screen.getByRole('button', { name: 'طابور طابور الأول' }));
    await screen.findByText('أحمد محمد')

    // Test buttons in toolbar
    const toolbar = screen.getByRole('toolbar', { name: 'إجراءات الطابور' });
    expect(toolbar).toBeInTheDocument();

    // Test Add Patient button exists
    const addButton = screen.getByRole('button', { name: 'إضافة مرضى جدد' });
    expect(addButton).toBeInTheDocument();
    fireEvent.click(addButton);

    // Test Delete button exists
    const deleteButton = screen.getByRole('button', { name: 'حذف المرضى المحددين' });
    expect(deleteButton).toBeInTheDocument();

    // Test Message Button exists
    const messageButton = screen.getByRole('button', { name: 'إرسال رسالة واتساب' });
    expect(messageButton).toBeInTheDocument();
  });

  test('handles CSV upload', async () => {
    render(<Dashboard />);
    // Wait for queues, select one and open CSV modal
    await screen.findByText('طابور الأول')
    fireEvent.click(screen.getByRole('button', { name: 'طابور طابور الأول' }));
    fireEvent.click(await screen.findByRole('button', { name: 'رفع ملف المرضى' }));

    // Check if upload modal is shown
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByLabelText('رفع ملف المرضى (CSV)')).toBeInTheDocument();

    // Verify progress bar exists
    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
  });

  test('handles messages and templates', async () => {
    render(<Dashboard />);
    // Wait for queues and open message modal
    await screen.findByText('طابور الأول')
    fireEvent.click(screen.getByText('طابور الأول'));
    await screen.findByText('أحمد محمد')

    // Open message modal
    fireEvent.click(screen.getByText('إرسال رسالة'));

  // Check if template selector is present
  const templateSelect = await screen.findByLabelText('قائمة القوالب');
    // expect(templateSelect).toBeInTheDocument();

    // Select a template
    fireEvent.change(templateSelect, { target: { value: 't1' } });

    await waitFor(() => {
      expect(screen.getByLabelText('معاينة الرسالة')).toHaveValue('مرحباً {{name}}، دورك رقم {{position}}');
    });
  });

  test('handles errors gracefully', async () => {
    // Mock API error for initial data loading
    api.get.mockImplementation((url) => {
      if (url === '/api/queues') {
        return Promise.reject(new Error('Failed to load'));
      }
      return Promise.resolve({ data: {} });
    });

    render(<Dashboard />);

    // Should show the default empty state message
    expect(await screen.findByText('الرجاء اختيار طابور لعرض المرضى')).toBeInTheDocument();
    expect(screen.getByText('الطوابير')).toBeInTheDocument();

    // Error should not prevent the app from loading
    expect(screen.getByRole('complementary', { name: 'القائمة الجانبية' })).toBeInTheDocument();
  });

  test('applies RTL layout correctly', () => {
    render(<Dashboard />);

    // Wait for the component to perform its async initial loads to avoid act() warnings
    return screen.findByRole('banner').then(() => {
      // Check for RTL direction on the root element
      expect(document.querySelector('[dir="rtl"]')).toBeInTheDocument();

      // Check for RTL specific classes
      const header = screen.getByRole('banner');
      const flexContainer = header.querySelector('.space-x-reverse');
      expect(flexContainer).toBeInTheDocument();
    });
  });
});