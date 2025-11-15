import { setupServer } from 'msw/node';
import { handlers, defaultFallbackHandler } from './handlers';

export const server = setupServer(...handlers, defaultFallbackHandler);
