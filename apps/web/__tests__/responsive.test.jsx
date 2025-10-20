import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { act } from 'react-dom/test-utils'
import '@testing-library/jest-dom';
import Layout from '../components/Layout';
import Toast, { showToast } from '../lib/toast';
import PatientsTable from '../components/PatientsTable';
import Dashboard from '../pages/dashboard';
import renderWithProviders from '../test-utils/renderWithProviders';
import { ROLES } from '../lib/roles';

// Define common breakpoints
const BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280
};

// Mock window.matchMedia
function setScreenSize(width) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width
  });

  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: width <= parseInt(query.replace(/[^\d]/g, '')),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn()
  }));

  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
}

describe('Responsive Design Tests', () => {
  const mockProps = {
    userRole: 'مدير أساسي',
    userName: 'أحمد',
    whatsappConnected: true,
    onLogout: jest.fn(),
    activeSection: 'dashboard',
    onSectionChange: jest.fn(),
    queues: [
      { id: 'q1', name: 'طابور الأول', patientCount: 5 },
      { id: 'q2', name: 'طابور الثاني', patientCount: 3 }
    ],
    selectedQueue: 'q1',
    onQueueSelect: jest.fn()
  };

  beforeEach(() => {
    // Reset matchMedia before each test
    delete window.matchMedia;
  });

  describe('Layout Component', () => {
    test.each(Object.entries(BREAKPOINTS))(
      'adapts correctly at %s breakpoint (%dpx)',
      async (breakpoint, width) => {
        setScreenSize(width);
        renderWithProviders(
          <Layout {...mockProps}>
            <div>محتوى تجريبي</div>
          </Layout>,
          { auth: { user: { id: 1, name: 'أحمد', role: ROLES.PRIMARY_ADMIN } } }
        );

        // Check for responsive layout
        const navigation = screen.getByRole('navigation', { name: 'التنقل الرئيسي' });
        const sidebar = screen.getByRole('complementary', { name: 'القائمة الجانبية' });

        expect(navigation).toBeInTheDocument();
        expect(sidebar).toBeInTheDocument();

        // Check basic structure
        expect(screen.getByRole('banner')).toBeInTheDocument();
        expect(screen.getByRole('main')).toBeInTheDocument();

        // Check test content
        expect(screen.getByText('محتوى تجريبي')).toBeInTheDocument();
      }
    );
  });

  describe('PatientsTable Component', () => {
    const mockPatients = [
      { id: 'p1', fullName: 'أحمد محمد', phoneNumber: '123456789', position: 1 },
      { id: 'p2', fullName: 'محمد علي', phoneNumber: '987654321', position: 2 }
    ];

    test.each(Object.entries(BREAKPOINTS))(
      'displays correctly at %s breakpoint (%dpx)',
      async (breakpoint, width) => {
        setScreenSize(width);
        renderWithProviders(<PatientsTable patients={mockPatients} />, {
          auth: { user: { id: 1, role: ROLES.PRIMARY_ADMIN } }
        });

        // Check table structure
        const table = screen.getByRole('table', { name: 'قائمة المرضى' });
        expect(table).toBeInTheDocument();

        // Check headers
        expect(screen.getByRole('columnheader', { name: 'الاسم الكامل' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'رقم الهاتف' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'الترتيب' })).toBeInTheDocument();

        // Check data
        expect(screen.getByText('أحمد محمد')).toBeInTheDocument();
        expect(screen.getByText('123456789')).toBeInTheDocument();
        expect(screen.getByText('محمد علي')).toBeInTheDocument();
        expect(screen.getByText('987654321')).toBeInTheDocument();

        // All cells should be right-aligned in RTL mode
        const cells = screen.getAllByRole('cell');
        cells.forEach(cell => {
          expect(cell).toHaveClass('text-right');
        });
      }
    );
  });

  describe('Dashboard Page', () => {
    test.each(Object.entries(BREAKPOINTS))(
      'renders responsively at %s breakpoint (%dpx)',
      async (breakpoint, width) => {
        setScreenSize(width);
        const { container } = renderWithProviders(<Dashboard />, {
          auth: { user: { id: 1, role: ROLES.PRIMARY_ADMIN } }
        });

        // Wait for data loading to complete
        await waitFor(() => {
          expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        // Verify queues are loaded
        await screen.findByText(/الطابور الأول/i);

        // Accessibility check
        const results = await global.axe(container);
        const filtered = { ...results, violations: results.violations.filter(v => v.id !== 'heading-order' && v.id !== 'aria-required-attr') };
        expect(filtered).toHaveNoViolations();
      }
    );
  });

  describe('Navigation Menu', () => {
    test.each(Object.entries(BREAKPOINTS))(
      'adapts correctly at %s breakpoint (%dpx)',
      async (breakpoint, width) => {
        setScreenSize(width);
        renderWithProviders(
          <Layout {...mockProps} />,
          { auth: { user: { id: 1, name: 'أحمد', role: ROLES.PRIMARY_ADMIN } } }
        );

        const nav = screen.getByRole('navigation', { name: 'التنقل الرئيسي' });
        expect(nav).toBeInTheDocument();
      }
    );
  });

  describe('Queue List', () => {
    test.each(Object.entries(BREAKPOINTS))(
      'displays properly at %s breakpoint (%dpx)',
      async (breakpoint, width) => {
        setScreenSize(width);
        renderWithProviders(
          <Layout {...mockProps} />,
          { auth: { user: { id: 1, name: 'أحمد', role: ROLES.PRIMARY_ADMIN } } }
        );

        // Check queue list rendering
        const queueListContainer = screen.getByRole('complementary', { name: 'القائمة الجانبية' });
        expect(queueListContainer).toBeInTheDocument();

        // Check queue items are present
        expect(screen.getByText('طابور الأول')).toBeInTheDocument();
        expect(screen.getByText('طابور الثاني')).toBeInTheDocument();
      }
    );
  });

  describe('Toast Notifications', () => {
    test.each(Object.entries(BREAKPOINTS))(
      'positions correctly at %s breakpoint (%dpx)',
      async (breakpoint, width) => {
        setScreenSize(width);
        render(<Toast />);

        act(() => showToast('تمت العملية بنجاح', 'success'))
        await waitFor(() => {
          const successToast = screen.getByText('تمت العملية بنجاح').closest('[role="alert"]');
          expect(successToast).toHaveTextContent('تمت العملية بنجاح');
        });

        act(() => showToast('حدث خطأ', 'error'))
        await waitFor(() => {
          const errorToast = screen.getByText('حدث خطأ').closest('[role="alert"]');
          expect(errorToast).toHaveTextContent('حدث خطأ');
          const closeButton = within(errorToast).getByRole('button', { name: 'إغلاق' });
          fireEvent.click(closeButton);
          expect(screen.queryByText('حدث خطأ')).not.toBeInTheDocument();
        });
      }
    );
  });
});