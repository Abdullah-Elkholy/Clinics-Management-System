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
            // Properly decode Base64 with UTF-8 support for Arabic characters
            // atob() doesn't handle UTF-8 properly, so we use a helper function
            const decodeBase64 = (str: string): string => {
              try {
                // Replace URL-safe Base64 characters: - becomes +, _ becomes /
                const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
                // Decode using TextDecoder for proper UTF-8 handling
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                return new TextDecoder('utf-8').decode(bytes);
              } catch (e) {
                console.error('❌ Base64 decoding failed:', e);
                throw new Error('Failed to decode JWT payload');
              }
            };
            
            const decoded = JSON.parse(decodeBase64(parts[1]));
            
            // Debug: Log full JWT payload to inspect structure
            console.log('🔐 Full JWT Payload:', JSON.stringify(decoded, null, 2));
            
            // Extract role - Try MULTIPLE possible claim keys that JWT might use
            // JWT standard claim type keys can be in different formats
            const roleFromDirect = decoded.role;  // Direct "role" claim
            const roleFromClaimType = decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];  // ClaimTypes.Role
            const roleFromAllClaims = Object.entries(decoded).find(([k, v]) => k.toLowerCase().includes('role'));
            
            const roleValue = roleFromDirect || roleFromClaimType || (roleFromAllClaims ? roleFromAllClaims[1] : undefined);
            
            console.log('🔐 Role Extraction Debug:', {
              roleFromDirect: `"${roleFromDirect}"`,
              roleFromClaimType: `"${roleFromClaimType}"`,
              roleFromAllClaims: roleFromAllClaims ? `${roleFromAllClaims[0]} = "${roleFromAllClaims[1]}"` : 'NOT_FOUND',
              finalRoleValue: `"${roleValue}"`,
              isRolePrimaryAdmin: roleValue === 'primary_admin',
              isRoleString: typeof roleValue === 'string',
            });
            
            // Ensure we have a valid role value
            const finalRole = (roleValue as UserRole) || UserRole.User;
            
            // Validate that the role is one of the allowed values
            const validRoles: UserRole[] = [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.User];
            const isValidRole = validRoles.includes(finalRole);
            
            console.log('🔐 Role Validation:', {
              roleValue: finalRole,
              isValidRole: isValidRole,
              validRoles: validRoles,
              matchesPrimaryAdmin: finalRole === UserRole.PrimaryAdmin,
            });
            
            if (!isValidRole) {
              console.warn(`⚠️ Invalid role "${finalRole}", defaulting to User role`);
            }
            
            // Map JWT claims to User object
            // Note: JwtTokenService creates claims with keys: "firstName", "lastName", "role"
            const user: User = {
              id: decoded.sub || decoded.userId || '',
              username: decoded.name || decoded.username || username,
              firstName: decoded.firstName || 'User',
              lastName: decoded.lastName || '',
              role: finalRole,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            // Debug: Log names specifically to verify Arabic characters are properly decoded
            console.log('🔐 User Names (UTF-8 Check):', {
              firstName: `"${user.firstName}"`,
              lastName: `"${user.lastName}"`,
              firstNameLength: user.firstName.length,
              lastNameLength: user.lastName.length,
              firstNameCharCodes: user.firstName.split('').map(c => c.charCodeAt(0)),
              lastNameCharCodes: user.lastName.split('').map(c => c.charCodeAt(0)),
            });
            
            console.log('👤 User object after mapping:', { ...user, isActive: user.isActive });
            
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
