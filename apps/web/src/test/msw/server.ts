import { setupServer } from 'msw/node';
import { handlers, defaultFallbackHandler, resetDb } from './handlers';

export const server = setupServer(...handlers, defaultFallbackHandler);

// Expose a DB reset helper for tests
export const resetMswDb = resetDb;
