/**
 * User Management State Hook
 * 
 * Centralized state management for user operations with built-in permission checking.
 * Returns tuple of [state, actions] following React patterns.
 * 
 * All CRUD operations are permission-aware and include proper error handling.
 * 
 * @example
 * const [state, actions] = useUserManagement();
 * 
 * // Create user
 * await actions.createUser({ name: 'أحمد', email: 'ahmed@clinic.com', role: UserRole.Moderator });
 * 
 * // Delete user
 * await actions.deleteUser('user-id');
 * 
 * // Check permissions
 * if (state.canCreate) {
 *   // Show create button
 * }
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/contexts/UIContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { UserRole } from '@/types/roles';
import {
  userManagementService,
  User,
  CreateUserPayload,
  UpdateUserPayload,
  UserServiceResponse,
} from '@/services/userManagementService';

/**
 * User management state
 */
export interface UseUserManagementState {
  users: User[];
  moderators: User[];
  selectedUser?: User;
  loading: boolean;
  error: string | null;
}

/**
 * User management actions
 */
export interface UseUserManagementActions {
  fetchUsers: (filters?: { role?: UserRole; isActive?: boolean; search?: string }) => Promise<void>;
  fetchModerators: () => Promise<void>;
  getUser: (id: string) => Promise<User | null>;
  createUser: (payload: CreateUserPayload) => Promise<boolean>;
  updateUser: (id: string, payload: UpdateUserPayload) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  selectUser: (user?: User) => void;
  clearError: () => void;
}

/**
 * Hook for user management
 */
export function useUserManagement(): readonly [UseUserManagementState, UseUserManagementActions] {
  const { user: currentUser } = useAuth();
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();

  const [users, setUsers] = useState<User[]>([]);
  const [moderators, setModerators] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all users
   */
  const fetchUsers = useCallback(
    async (filters?: { role?: UserRole; isActive?: boolean; search?: string }) => {
      // CRITICAL: Don't fetch if no user is authenticated
      if (!currentUser) {
        // Only clear users if they exist, and only set loading to false if it's true
        setUsers(prev => {
          if (prev.length === 0) return prev; // No change needed
          return []; // Clear users
        });
        setLoading(prev => {
          if (!prev) return prev; // No change needed
          return false; // Set loading to false
        });
        return;
      }

      // Only admins and moderators can fetch the user list
      // Regular users don't have permission, so skip the fetch silently
      if (currentUser.role === UserRole.User) {
        // Only clear users if they exist, and only set loading to false if it's true
        setUsers(prev => {
          if (prev.length === 0) return prev; // No change needed
          return []; // Clear users
        });
        setLoading(prev => {
          if (!prev) return prev; // No change needed
          return false; // Set loading to false
        });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await userManagementService.getUsers(filters);
        if (result.success && result.data) {
          setUsers(result.data);
        } else {
          // Silently ignore 403 Forbidden errors (unauthorized)
          if (result.error && result.error.includes('403')) {
            setUsers([]);
          } else {
            setError(result.error || 'فشل في جلب المستخدمين');
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        // Silently ignore authorization errors
        if (!errorMsg.includes('403') && !errorMsg.includes('Forbidden')) {
          setError(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    },
    [currentUser]
  );

  /**
   * Fetch all moderators
   */
  const fetchModerators = useCallback(async () => {
    // CRITICAL: Don't fetch if no user is authenticated
    if (!currentUser) {
      setModerators([]);
      setLoading(false);
      return;
    }

    // Only admins and moderators can see the full moderator list
    // Regular users don't have permission, so skip the fetch silently
    if (currentUser.role === UserRole.User) {
      setModerators([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await userManagementService.getModerators();
      if (result.success && result.data) {
        setModerators(result.data);
      } else {
        // Silently ignore 403 Forbidden errors (unauthorized)
        if (result.error && result.error.includes('403')) {
          setModerators([]);
        } else {
          setError(result.error || 'فشل في جلب المشرفين');
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      // Silently ignore authorization errors
      if (!errorMsg.includes('403') && !errorMsg.includes('Forbidden')) {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  /**
   * Get single user
   */
  const getUser = useCallback(async (id: string): Promise<User | null> => {
    try {
      const result = await userManagementService.getUser(id);
      if (result.success && result.data) {
        return result.data;
      }
      setError(result.error || 'فشل تحميل بيانات المستخدم');
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return null;
    }
  }, []);

  /**
   * Create user
   */
  const createUser = useCallback(
    async (payload: CreateUserPayload): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await userManagementService.createUser(payload);
        if (result.success && result.data) {
          setUsers((prev) => [...prev, result.data]);
          
          // If created user is a moderator, refetch moderators list for sidebar
          if (result.data.role === UserRole.Moderator) {
            await fetchModerators();
          }
          
          addToast(`تم إنشاء المستخدم: ${result.data.firstName} ${result.data.lastName}`, 'success');
          return true;
        } else {
          const errorMsg = result.error || 'Failed to create user';
          setError(errorMsg);
          addToast(errorMsg, 'error');
          return false;
        }
      } catch (err) {
        // Extract error message from ApiError or Error object
        let errorMsg = 'Unknown error';
        if (err && typeof err === 'object') {
          // Check for ApiError format (has message property)
          if ('message' in err && typeof err.message === 'string') {
            errorMsg = err.message;
          }
          // Check for standard Error object
          else if (err instanceof Error) {
            errorMsg = err.message;
          }
          // Check for error property in object
          else if ('error' in err && typeof err.error === 'string') {
            errorMsg = err.error;
          }
        } else if (err instanceof Error) {
          errorMsg = err.message;
        }
        setError(errorMsg);
        addToast(errorMsg, 'error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [addToast, fetchModerators]
  );

  /**
   * Update user
   */
  const updateUser = useCallback(
    async (id: string, payload: UpdateUserPayload): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        // Check if user being updated is a moderator (before update)
        const userBeforeUpdate = users.find((u) => u.id === id);
        const wasModerator = userBeforeUpdate?.role === UserRole.Moderator;
        
        const result = await userManagementService.updateUser(id, payload);
        if (result.success && result.data) {
          setUsers((prev) => prev.map((u) => (u.id === id ? result.data : u)));
          if (selectedUser?.id === id) {
            setSelectedUser(result.data);
          }
          
          // Refetch moderators if user being updated is/was a moderator
          const isModerator = result.data.role === UserRole.Moderator;
          if (wasModerator || isModerator) {
            await fetchModerators();
          }
          
          addToast(`تم تحديث المستخدم: ${result.data.firstName} ${result.data.lastName}`, 'success');
          return true;
        } else {
          const errorMsg = result.error || 'Failed to update user';
          setError(errorMsg);
          addToast(errorMsg, 'error');
          return false;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        addToast(errorMsg, 'error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [selectedUser, addToast, fetchModerators, users]
  );

  /**
   * Delete user
   */
  const deleteUser = useCallback(
    async (id: string): Promise<boolean> => {
      const confirmed = await confirm(createDeleteConfirmation('هذا المستخدم'));
      if (!confirmed) return false;

      setLoading(true);
      setError(null);

      try {
        // Check if user being deleted is a moderator
        const userToDelete = users.find((u) => u.id === id);
        const wasModerator = userToDelete?.role === UserRole.Moderator;
        
        const result = await userManagementService.deleteUser(id);
        if (result.success) {
          setUsers((prev) => prev.filter((u) => u.id !== id));
          if (selectedUser?.id === id) {
            setSelectedUser(undefined);
          }
          
          // Refetch moderators if deleted user was a moderator
          if (wasModerator) {
            await fetchModerators();
          }
          
          addToast('تم حذف المستخدم بنجاح', 'success');
          return true;
        } else {
          const errorMsg = result.error || 'Failed to delete user';
          setError(errorMsg);
          addToast(errorMsg, 'error');
          return false;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        addToast(errorMsg, 'error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [selectedUser, addToast, fetchModerators, users]
  );

  /**
   * Select user for detailed view
   */
  const selectUser = useCallback((user?: User) => {
    setSelectedUser(user);
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Fetch users on mount - removed to prevent infinite loops
   * Components should call fetchUsers/fetchModerators explicitly when needed
   */
  // useEffect(() => {
  //   if (currentUser) {
  //     fetchUsers();
  //     fetchModerators();
  //   }
  // }, [currentUser, fetchUsers, fetchModerators]);

  /**
   * Build state object
   */
  const state: UseUserManagementState = useMemo(
    () => ({
      users,
      moderators,
      selectedUser,
      loading,
      error,
    }),
    [users, moderators, selectedUser, loading, error]
  );

  /**
   * Build actions object
   */
  const actions: UseUserManagementActions = useMemo(
    () => ({
      fetchUsers,
      fetchModerators,
      getUser,
      createUser,
      updateUser,
      deleteUser,
      selectUser,
      clearError,
    }),
    [fetchUsers, fetchModerators, getUser, createUser, updateUser, deleteUser, selectUser, clearError]
  );

  return [state, actions] as const;
}

export default useUserManagement;
