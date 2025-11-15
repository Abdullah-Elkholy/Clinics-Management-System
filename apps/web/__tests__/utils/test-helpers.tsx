// Compatibility shim: re-export from new location so existing imports won't break
export * from '../../test-utils/test-helpers';

// Add a placeholder skipped test so Jest doesn't error on an empty suite
describe('test-helpers placeholder (moved to apps/web/test-utils)', () => {
  it.skip('placeholder to prevent Jest no-tests error', () => {
    expect(true).toBe(true);
  });
});
