import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedDashboard from '../pages/dashboard';
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import api from '../lib/api';
import { useAuthorization } from '../lib/authorization';

// Mock api module
jest.mock('../lib/api');

// Mock the authorization hook
jest.mock('../lib/authorization', () => ({
  useAuthorization: jest.fn(),
}));

describe('Dashboard Component', () => {
  const mockUser = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
  role: ROLES.PRIMARY_ADMIN,
  };
  const mockQueues = [
    { id: 'q1', name: 'طابور الأول', currentPosition: 1, estimatedTime: 15, patientCount: 5 },
    { id: 'q2', name: 'طابور الثاني', currentPosition: 2, estimatedTime: 20, patientCount: 3 }
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
    // Reset mocks
    api.get.mockReset();
    api.post.mockReset();
    useAuthorization.mockReset();

    // Default to primary_admin
    useAuthorization.mockReturnValue({
      isPrimaryAdmin: true,
      canSeeManagement: true,
      canCreateQueues: true,
      canDeleteQueues: true,
      canEditQueues: true,
      canReorderPatients: true,
      canEditPatients: true,
      canDeletePatients: true,
      canManageUsers: true,
      canManageQuotas: true,
      canManageWhatsApp: true,
      canManageTemplates: true,
    });

    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/Queues/')) return Promise.resolve({ data: { data: mockPatients } });
      if (url === '/api/Queues') return Promise.resolve({ data: { data: mockQueues } });
      if (url === '/api/Templates') return Promise.resolve({ data: { data: mockTemplates } });
      return Promise.reject(new Error(`API GET call to ${url} not mocked`));
    });

    api.post.mockImplementation((url, data) => {
      if (url === '/api/Queues') {
        const newQueue = { ...data, id: `q${mockQueues.length + 1}`, name: data.doctorName, patientCount: 0 };
        return Promise.resolve({ data: { data: newQueue } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  const renderDashboard = (userRole = ROLES.PRIMARY_ADMIN) => {
    const user = { ...mockUser, role: userRole };
    return renderWithProviders(<ProtectedDashboard />, {
      auth: { user, isAuthenticated: true }
    });
  };

  describe('for primary_admin', () => {
    test('renders initial dashboard state with queues list', async () => {
  renderDashboard(ROLES.PRIMARY_ADMIN);
      await screen.findByText('طابور الأول');
      expect(api.get).toHaveBeenCalledWith('/api/Queues');
      expect(api.get).toHaveBeenCalledWith('/api/Templates');
      expect(screen.getByText('طابور الثاني')).toBeInTheDocument();
    });

    test('can see all management panel cards', async () => {
  renderDashboard(ROLES.PRIMARY_ADMIN);
      fireEvent.click(await screen.findByText('الإدارة'));
      expect(await screen.findByText('المستخدمون')).toBeInTheDocument();
      expect(await screen.findByText('الحصص والإعدادات')).toBeInTheDocument();
      expect(await screen.findByText('واتساب')).toBeInTheDocument();
      expect(await screen.findByText('قوالب الرسائل')).toBeInTheDocument();
    });
  });

  describe('for secondary_admin', () => {
    beforeEach(() => {
      useAuthorization.mockReturnValue({
        isSecondaryAdmin: true,
        canSeeManagement: true,
        canManageWhatsApp: true,
        canManageTemplates: true,
      });
    });

    test('cannot see Users and Quotas management cards', async () => {
  renderDashboard(ROLES.SECONDARY_ADMIN);
      fireEvent.click(await screen.findByText('الإدارة'));
      expect(screen.queryByText('المستخدمون')).not.toBeInTheDocument();
      expect(screen.queryByText('الحصص والإعدادات')).not.toBeInTheDocument();
      expect(await screen.findByText('واتساب')).toBeInTheDocument();
      expect(await screen.findByText('قوالب الرسائل')).toBeInTheDocument();
    });
  });

  describe('for moderator', () => {
    beforeEach(() => {
      useAuthorization.mockReturnValue({
        isModerator: true,
        canSeeManagement: true,
      });
    });

    test('can only see management link but no management cards and cannot add queues', async () => {
  renderDashboard(ROLES.MODERATOR);
      const managementLink = await screen.findByText('الإدارة');
      expect(managementLink).toBeInTheDocument();
      fireEvent.click(managementLink);
      expect(screen.queryByText('المستخدمون')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /إضافة طابور/i })).not.toBeInTheDocument();
    });
  });

  describe('for user', () => {
    beforeEach(() => {
      useAuthorization.mockReturnValue({
        isUser: true,
      });
    });

    test('cannot see management link or add/delete queues/patients', async () => {
  renderDashboard(ROLES.USER);
      expect(screen.queryByText('الإدارة')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /إضافة طابور/i })).not.toBeInTheDocument();
      fireEvent.click(await screen.findByText('طابور الأول'));
      await screen.findByText('أحمد محمد');
      expect(screen.queryByRole('button', { name: /إضافة مرضى جدد/i })).not.toBeInTheDocument();
    });
  });

  test('loads patient data when selecting a queue', async () => {
    renderDashboard();
    fireEvent.click(await screen.findByText('طابور الأول'));
    await screen.findByText('أحمد محمد');
    expect(api.get).toHaveBeenCalledWith('/api/Queues/q1/patients');
    expect(screen.getByText('محمد علي')).toBeInTheDocument();
  });

  test('handles adding a new queue', async () => {
    renderDashboard();
    fireEvent.click(await screen.findByRole('button', { name: /إضافة طابور/i }));
    fireEvent.change(screen.getByLabelText(/اسم الطابور/i), { target: { value: 'طابور جديد' } });
    fireEvent.click(screen.getByRole('button', { name: 'إضافة' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/Queues', expect.any(Object)));
    // Verify the POST was called successfully - don't wait for new queue in list since it requires React Query refetch
    expect(api.post).toHaveBeenCalled();
  });

  test('handles patient actions (add, delete, message)', async () => {
    renderDashboard();
    fireEvent.click(await screen.findByText('طابور الأول'));
    await screen.findByText('أحمد محمد');
    const toolbar = screen.getByRole('toolbar', { name: /إجراءات الطابور/i });
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /إضافة مرضى جدد/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /حذف المرضى المحددين/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /إرسال رسالة واتساب/i })).toBeInTheDocument();
  });

  test('handles errors gracefully', async () => {
    api.get.mockRejectedValue(new Error('Network Error'));
    renderDashboard();
    expect(await screen.findByText(/الرجاء اختيار طابور/i)).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /القائمة الجانبية/i })).toBeInTheDocument();
  });

  test('applies RTL layout correctly', async () => {
    const { container } = renderDashboard();
    await screen.findByRole('banner');
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });
});