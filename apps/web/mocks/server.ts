/**
 * MSW (Mock Service Worker) Server Configuration
 * 
 * DEFERRED - This file will be used during the testing phase.
 * MSW is not yet installed; server will be activated when testing begins.
 * 
 * Provides mock HTTP handlers for testing.
 * This intercepts fetch requests during tests and returns predictable responses.
 */

// @ts-nocheck - Disable type checking for deferred MSW integration
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
