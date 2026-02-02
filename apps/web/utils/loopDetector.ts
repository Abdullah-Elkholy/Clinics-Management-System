/**
 * Loop Detector Utility
 * Detects and prevents infinite loops in authentication/navigation
 */

const LOOP_DETECTION_KEY = 'auth_loop_detector';
const PAGE_LOAD_KEY = 'page_load_count';
const MAX_ATTEMPTS = 4; // Reduced from 5
const MAX_PAGE_LOADS = 6; // Max page loads in time window
const RESET_INTERVAL = 8000; // 8 seconds (reduced from 10)
const PAGE_LOAD_WINDOW = 15000; // 15 second window for page loads

interface LoopDetectorState {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

interface PageLoadState {
  loads: number[];
}

export class LoopDetector {
  private static getState(): LoopDetectorState {
    try {
      const stored = sessionStorage.getItem(LOOP_DETECTION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Ignore
    }
    return { count: 0, firstAttempt: Date.now(), lastAttempt: Date.now() };
  }

  private static setState(state: LoopDetectorState): void {
    try {
      sessionStorage.setItem(LOOP_DETECTION_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore
    }
  }

  private static getPageLoadState(): PageLoadState {
    try {
      const stored = sessionStorage.getItem(PAGE_LOAD_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Ignore
    }
    return { loads: [] };
  }

  private static setPageLoadState(state: PageLoadState): void {
    try {
      sessionStorage.setItem(PAGE_LOAD_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Records a page load and returns true if too many loads detected
   */
  static recordPageLoad(): boolean {
    const state = this.getPageLoadState();
    const now = Date.now();
    
    // Filter to only recent loads
    const recentLoads = state.loads.filter(t => now - t < PAGE_LOAD_WINDOW);
    recentLoads.push(now);
    
    this.setPageLoadState({ loads: recentLoads });
    
    if (recentLoads.length >= MAX_PAGE_LOADS) {
      console.error(`[LoopDetector] Too many page loads (${recentLoads.length}) in ${PAGE_LOAD_WINDOW}ms`);
      return true;
    }
    
    return false;
  }

  /**
   * Records an attempt and returns true if loop is detected
   */
  static recordAttempt(context: string): boolean {
    const state = this.getState();
    const now = Date.now();

    // Reset if enough time has passed
    if (now - state.lastAttempt > RESET_INTERVAL) {
      this.setState({ count: 1, firstAttempt: now, lastAttempt: now });
      return false;
    }

    // Increment counter
    const newState = {
      ...state,
      count: state.count + 1,
      lastAttempt: now,
    };
    this.setState(newState);

    // Check if loop detected
    if (newState.count >= MAX_ATTEMPTS) {
      console.error(`[LoopDetector] Infinite loop detected in ${context}:`, {
        attempts: newState.count,
        timespan: now - state.firstAttempt,
      });
      return true;
    }

    return false;
  }

  /**
   * Resets the loop detector
   */
  static reset(): void {
    try {
      sessionStorage.removeItem(LOOP_DETECTION_KEY);
      sessionStorage.removeItem(PAGE_LOAD_KEY);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Emergency break - clears all auth data and reloads
   */
  static emergencyBreak(): void {
    console.error('[LoopDetector] Executing emergency break');
    
    // Clear all auth-related data
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('selectedQueueId');
      sessionStorage.clear();
      
      // Clear auth cookies
      document.cookie = 'auth=; Path=/; SameSite=Lax; Max-Age=0';
      document.cookie = 'redirect_count=0; Path=/; Max-Age=0';
      
      // Set a flag to prevent immediate re-loop
      sessionStorage.setItem('emergency_break_executed', Date.now().toString());
      
      // Force reload to login
      window.location.href = '/login';
    } catch (e) {
      console.error('[LoopDetector] Emergency break failed:', e);
      // Last resort
      window.location.reload();
    }
  }

  /**
   * Check if emergency break was recently executed
   */
  static wasEmergencyBreakRecent(): boolean {
    try {
      const breakTime = sessionStorage.getItem('emergency_break_executed');
      if (breakTime) {
        const elapsed = Date.now() - parseInt(breakTime, 10);
        return elapsed < 5000; // Within 5 seconds
      }
    } catch (e) {
      // Ignore
    }
    return false;
  }
}
