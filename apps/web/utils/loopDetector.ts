/**
 * Loop Detector Utility
 * Detects and breaks authentication redirect loops and stuck states
 * 
 * This utility tracks:
 * 1. Page load frequency - detects rapid refreshes
 * 2. Auth attempt frequency - detects redirect loops
 * 3. Provides emergency break mechanism
 */

const LOOP_STATE_KEY = 'auth_loop_detector';
const PAGE_LOAD_KEY = 'page_load_count';
const EMERGENCY_BREAK_KEY = 'emergency_break_executed';

// Configuration
const MAX_ATTEMPTS_BEFORE_LOOP = 4; // 4 attempts in window = loop detected
const ATTEMPT_WINDOW_MS = 8000; // 8 second window for attempts
const MAX_PAGE_LOADS = 6; // 6 page loads in window = stuck
const PAGE_LOAD_WINDOW_MS = 15000; // 15 second window for page loads
const EMERGENCY_BREAK_COOLDOWN_MS = 5000; // 5 second cooldown after emergency break

interface LoopState {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

interface PageLoadState {
  loads: number[];
}

/**
 * LoopDetector - Static utility class for detecting auth loops
 */
export class LoopDetector {
  /**
   * Get current loop state from session storage
   */
  static getState(): LoopState {
    try {
      const stored = sessionStorage.getItem(LOOP_STATE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Ignore storage errors
    }
    return { count: 0, firstAttempt: Date.now(), lastAttempt: Date.now() };
  }

  /**
   * Save loop state to session storage
   */
  static setState(state: LoopState): void {
    try {
      sessionStorage.setItem(LOOP_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Get page load tracking state
   */
  static getPageLoadState(): PageLoadState {
    try {
      const stored = sessionStorage.getItem(PAGE_LOAD_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Ignore storage errors
    }
    return { loads: [] };
  }

  /**
   * Save page load state
   */
  static setPageLoadState(state: PageLoadState): void {
    try {
      sessionStorage.setItem(PAGE_LOAD_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Record a page load and check if too many loads detected
   * @returns true if too many page loads detected (stuck state)
   */
  static recordPageLoad(): boolean {
    const state = this.getPageLoadState();
    const now = Date.now();
    
    // Filter to only keep loads within the window
    const recentLoads = state.loads.filter(
      timestamp => now - timestamp < PAGE_LOAD_WINDOW_MS
    );
    
    // Add current load
    recentLoads.push(now);
    
    // Save updated state
    this.setPageLoadState({ loads: recentLoads });
    
    // Check if too many loads
    if (recentLoads.length >= MAX_PAGE_LOADS) {
      console.error(`[LoopDetector] Too many page loads (${recentLoads.length}) in ${PAGE_LOAD_WINDOW_MS}ms`);
      return true;
    }
    
    return false;
  }

  /**
   * Record an auth attempt and check if loop detected
   * @param context - Context string for logging (e.g., 'ProtectedRoute', 'AuthGuard')
   * @returns true if loop detected
   */
  static recordAttempt(context: string): boolean {
    const state = this.getState();
    const now = Date.now();
    
    // If last attempt was too long ago, reset counter
    if (now - state.lastAttempt > ATTEMPT_WINDOW_MS) {
      this.setState({ count: 1, firstAttempt: now, lastAttempt: now });
      return false;
    }
    
    // Increment counter
    const newState: LoopState = {
      ...state,
      count: state.count + 1,
      lastAttempt: now,
    };
    
    this.setState(newState);
    
    // Check if loop detected
    if (newState.count >= MAX_ATTEMPTS_BEFORE_LOOP) {
      console.error(`[LoopDetector] Infinite loop detected in ${context}:`, {
        attempts: newState.count,
        timespan: now - state.firstAttempt,
      });
      return true;
    }
    
    return false;
  }

  /**
   * Reset all loop detection state (call on successful auth)
   */
  static reset(): void {
    try {
      sessionStorage.removeItem(LOOP_STATE_KEY);
      sessionStorage.removeItem(PAGE_LOAD_KEY);
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Execute emergency break - clear all auth state and redirect to login
   * Use this when a loop is detected to break out of it
   */
  static emergencyBreak(): void {
    console.error('[LoopDetector] Executing emergency break');
    
    try {
      // Clear all auth-related data
      localStorage.removeItem('token');
      localStorage.removeItem('selectedQueueId');
      sessionStorage.clear();
      
      // Clear auth cookies
      document.cookie = 'auth=; Path=/; SameSite=Lax; Max-Age=0';
      document.cookie = 'redirect_count=0; Path=/; Max-Age=0';
      
      // Mark that emergency break was executed
      sessionStorage.setItem(EMERGENCY_BREAK_KEY, Date.now().toString());
      
      // Force redirect to login
      window.location.href = '/login';
    } catch (e) {
      console.error('[LoopDetector] Emergency break failed:', e);
      // Last resort - just reload
      window.location.reload();
    }
  }

  /**
   * Check if emergency break was recently executed
   * Used to prevent re-triggering emergency break immediately after one
   */
  static wasEmergencyBreakRecent(): boolean {
    try {
      const timestamp = sessionStorage.getItem(EMERGENCY_BREAK_KEY);
      if (timestamp) {
        const elapsed = Date.now() - parseInt(timestamp, 10);
        return elapsed < EMERGENCY_BREAK_COOLDOWN_MS;
      }
    } catch (e) {
      // Ignore storage errors
    }
    return false;
  }

  /**
   * Clear emergency break flag
   */
  static clearEmergencyBreak(): void {
    try {
      sessionStorage.removeItem(EMERGENCY_BREAK_KEY);
    } catch (e) {
      // Ignore storage errors
    }
  }
}

export default LoopDetector;
