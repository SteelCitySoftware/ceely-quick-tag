/**
 * Basic sanity test to ensure the test runner works
 */
describe('Basic functionality', () => {
  test('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
  });
});