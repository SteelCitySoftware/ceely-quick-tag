// Basic smoke test to ensure Jest is working
describe('App Basic Tests', () => {
  test('Jest is working correctly', () => {
    expect(true).toBe(true);
  });

  test('Environment variables are available', () => {
    // Basic test to ensure the test environment is set up
    expect(process.env.NODE_ENV).toBeDefined();
  });

  test('Basic arithmetic operations work', () => {
    expect(2 + 2).toBe(4);
    expect(5 * 3).toBe(15);
  });
});