'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../components/Auth/LoginScreen';
import MainApp from '../components/MainApp/MainApp';

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null); // null = not checked yet

  // Mark as mounted on client side only and check token
  useEffect(() => {
    setIsMounted(true);
    
    // Check for token immediately
    const token = localStorage.getItem('token');
    setHasToken(!!token);
  }, []);

  // Update hasToken when authentication state changes (e.g., after successful login or logout)
  useEffect(() => {
    if (!isMounted) return;
    
    // Check token in localStorage to sync with auth state
    const token = localStorage.getItem('token');
    const tokenExists = !!token;
    
    // When user becomes authenticated, update hasToken
    if (isAuthenticated && tokenExists) {
      setHasToken(true);
    } 
    // When user logs out (not authenticated and no token), show loading first, then login
    else if (!isAuthenticated && !tokenExists) {
      // If we currently have a token (user was logged in), show loading first
      if (hasToken === true) {
        // Set to null first to show loading state
        setHasToken(null);
        // Brief delay to show loading, then show login
        const timer = setTimeout(() => {
          setHasToken(false);
        }, 400);
        return () => clearTimeout(timer);
      } 
      // If we don't have a token, just set to false (no loading needed)
      else if (hasToken !== false) {
        setHasToken(false);
      }
    }
  }, [isAuthenticated, isMounted, hasToken]);

  // Check authentication and redirect if needed
  useEffect(() => {
    if (!isMounted || hasToken === null) return;

    // Clean URL of any sensitive parameters first
    const hasSensitiveParams = searchParams.has('username') || searchParams.has('password');
    if (hasSensitiveParams) {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete('username');
      newSearchParams.delete('password');
      const newUrl = newSearchParams.toString() 
        ? `${window.location.pathname}?${newSearchParams.toString()}`
        : window.location.pathname;
      router.replace(newUrl);
    }

    // If no token, we're done - show login (handled in render)
    if (!hasToken) {
      return;
    }

    // Token exists - wait a bit for AuthContext to validate it
    const timer = setTimeout(() => {
      // After timeout, check if still not authenticated
      if (!isAuthenticated) {
        // Token exists but user is not authenticated - might be invalid
        // Clear token and update state
        localStorage.removeItem('token');
        setHasToken(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isMounted, hasToken, isAuthenticated, searchParams, router]);

  // Show loading state:
  // 1. During SSR (not mounted yet)
  // 2. While checking token (hasToken === null)
  // 3. During logout transition (hasToken transitioning from true to false)
  if (!isMounted || hasToken === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // If authenticated, show MainApp immediately
  if (isAuthenticated && hasToken) {
    return <MainApp />;
  }

  // If no token or not authenticated, show login
  // (This covers: no token, logout, or token exists but validation failed)
  return <LoginScreen />;
}
