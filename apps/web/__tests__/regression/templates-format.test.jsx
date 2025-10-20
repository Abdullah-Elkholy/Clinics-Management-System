/**
 * Regression tests for Templates Data Format Fix
 * Tests cover:
 * 1. Backend returns { success: true, data: [...] }
 * 2. Frontend hook handles both formats
 * 3. Templates array is always valid
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTemplates } from '../../lib/hooks';
import api from '../../lib/api';

jest.mock('../../lib/api');

describe('Templates Data Format - Regression Tests', () => {
  let queryClient;
  let wrapper;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    jest.clearAllMocks();
  });

  test('should handle backend format: { success: true, data: [...] }', async () => {
    const mockTemplates = [
      { id: 1, title: 'Template 1', content: 'Content 1' },
      { id: 2, title: 'Template 2', content: 'Content 2' },
    ];

    api.get.mockResolvedValue({
      data: {
        success: true,
        data: mockTemplates,
      },
    });

    const { result } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockTemplates);
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  test('should handle legacy format: { success: true, templates: [...] }', async () => {
    const mockTemplates = [
      { id: 1, title: 'Template 1', content: 'Content 1' },
      { id: 2, title: 'Template 2', content: 'Content 2' },
    ];

    api.get.mockResolvedValue({
      data: {
        success: true,
        templates: mockTemplates,
      },
    });

    const { result } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockTemplates);
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  test('should return empty array when no templates', async () => {
    api.get.mockResolvedValue({
      data: {
        success: true,
        data: [],
      },
    });

    const { result } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  test('should handle malformed response gracefully', async () => {
    api.get.mockResolvedValue({
      data: {
        success: true,
        // No data or templates property
      },
    });

    const { result } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should fallback to empty array
    expect(result.current.data).toEqual([]);
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  test('should handle templates.find() without errors', async () => {
    const mockTemplates = [
      { id: 1, title: 'Template 1', content: 'Content 1' },
      { id: 2, title: 'Template 2', content: 'Content 2' },
    ];

    api.get.mockResolvedValue({
      data: {
        success: true,
        data: mockTemplates,
      },
    });

    const { result } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should be able to use array methods
    const foundTemplate = result.current.data.find(t => t.id === 1);
    expect(foundTemplate).toEqual(mockTemplates[0]);

    const mappedTitles = result.current.data.map(t => t.title);
    expect(mappedTitles).toEqual(['Template 1', 'Template 2']);
  });

  test('should cache templates data', async () => {
    const mockTemplates = [
      { id: 1, title: 'Template 1', content: 'Content 1' },
    ];

    api.get.mockResolvedValue({
      data: {
        success: true,
        data: mockTemplates,
      },
    });

    // First render
    const { result: result1 } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    expect(api.get).toHaveBeenCalledTimes(1);

    // Second render (should use cache)
    const { result: result2 } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => {
      expect(result2.current.isSuccess).toBe(true);
    });

    // Should not make another API call (using cached data)
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(result2.current.data).toEqual(mockTemplates);
  });
});
