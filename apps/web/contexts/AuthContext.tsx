'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User, AuthState } from '../types';
import { UserRole } from '@/types/roles';
import { login as loginApi, logout as logoutApi } from '@/services/api/authApiClient';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await loginApi({ username, password });
      
      if (response.success && response.data?.accessToken) {
        // Store token in localStorage
        localStorage.setItem('token', response.data.accessToken);
        
        // Decode token to get user info (JWT payload is base64-encoded JSON)
        const parts = response.data.accessToken.split('.');
        if (parts.length === 3) {
          try {
            const decoded = JSON.parse(atob(parts[1]));
            
            // Map JWT claims to User object
            // Note: JwtTokenService creates claims with keys: "firstName", "lastName", "role"
            const user: User = {
              id: decoded.sub || decoded.userId || '',
              username: decoded.name || decoded.username || username,
              firstName: decoded.firstName || 'User',
              lastName: decoded.lastName || '',
              role: (decoded.role as UserRole) || UserRole.User,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            setAuthState({
              user,
              isAuthenticated: true,
            });
            return true;
          } catch (e) {
            console.warn('Failed to decode JWT:', e);
            // Still set user as authenticated even if decode fails
            setAuthState({
              user: {
                id: '1',
                username,
                firstName: username,
                lastName: '',
                role: UserRole.User,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              isAuthenticated: true,
            });
            return true;
          }
        }
      }
    } catch (error) {
      // Improve error logging to see actual error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'message' in error)
        ? (error as any).message
        : 'Unknown error';
      console.error('Login error:', errorMessage, error);
      return false;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    logoutApi();
    setAuthState({
      user: null,
      isAuthenticated: false,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
