/**
 * Regression tests for Auth Refresh Fix
 * Tests cover:
 * 1. Token persistence on page refresh
 * 2. No redirect to login when token exists
 * 3. Proper loading states during auth check
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../../lib/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/router';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock api
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    defaults: {
      headers: {},
    },
  },
}));

const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  pathname: '/dashboard',
  query: {},
};

function TestComponent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user">{user ? user.username : 'No User'}</div>
    </div>
  );
}

describe('Auth Refresh - Regression Tests', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockPush.mockClear();
    useRouter.mockReturnValue(mockRouter);
    localStorage.clear();
  });

  test('should load token from localStorage on initialization', async () => {
    const mockToken = 'test-token-12345';
    localStorage.setItem('token', mockToken);

    const api = require('../../lib/api').default;
    api.get.mockResolvedValue({
      data: { data: { id: 1, username: 'testuser', role: 'user' } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    );

    // Initially should be loading
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading');

    // Wait for auth to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    // Should be authenticated
    expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('testuser');

    // Should NOT redirect to login
    expect(mockPush).not.toHaveBeenCalledWith('/login');
  });

  test('should show loading state during initial auth check', () => {
    const mockToken = 'test-token-12345';
    localStorage.setItem('token', mockToken);

    const api = require('../../lib/api').default;
    api.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    );

    // Should show loading immediately
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
  });

  test('should not be loading when no token exists', async () => {
    // No token in localStorage

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    );

    // Should complete initialization quickly
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
  });

  test('should handle invalid token gracefully', async () => {
    const mockToken = 'invalid-token';
    localStorage.setItem('token', mockToken);

    const api = require('../../lib/api').default;
    api.get.mockRejectedValue(new Error('Unauthorized'));

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    );

    // Should redirect to login when token is invalid
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    // Token should be cleared
    expect(localStorage.getItem('token')).toBeNull();
  });

  test('should persist authentication across component remounts', async () => {
    const mockToken = 'test-token-12345';
    localStorage.setItem('token', mockToken);

    const api = require('../../lib/api').default;
    api.get.mockResolvedValue({
      data: { data: { id: 1, username: 'testuser', role: 'user' } },
    });

    const { unmount, rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
    });

    // Unmount and remount
    unmount();
    
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    );

    // Should still be authenticated after remount
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
    });
  });
});
