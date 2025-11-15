/**
 * Global type declarations for DOM APIs and test environment
 * Provides ambient types for browser/Node.js APIs used across the codebase
 */

// DOM File API types
declare global {
  type BlobPart = string | Blob | ArrayBuffer | ArrayBufferView;

  interface FilePropertyBag extends BlobPropertyBag {
    lastModified?: number;
  }

  // Fetch API types (for no-undef in API clients)
  type HeadersInit = string[][] | Record<string, string> | Headers;
  
  interface RequestInit {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit | null;
    mode?: RequestMode;
    credentials?: RequestCredentials;
    cache?: RequestCache;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    integrity?: string;
    keepalive?: boolean;
    signal?: AbortSignal | null;
  }
}

export {};
