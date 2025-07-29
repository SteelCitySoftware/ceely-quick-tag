import { LoginErrorType } from '@shopify/shopify-app-remix/server';
import { loginErrorMessage } from './error.server';

// Mock LoginError type
type MockLoginError = {
  shop?: LoginErrorType;
};

describe('auth login error.server', () => {
  describe('loginErrorMessage function', () => {
    it('should return empty object for no errors', () => {
      const result = loginErrorMessage({});
      expect(result).toEqual({});
    });

    it('should return empty object for undefined errors', () => {
      const result = loginErrorMessage(undefined as any);
      expect(result).toEqual({});
    });

    it('should handle MissingShop error', () => {
      const loginErrors: MockLoginError = {
        shop: LoginErrorType.MissingShop,
      };

      const result = loginErrorMessage(loginErrors as any);

      expect(result).toEqual({
        shop: 'Please enter your shop domain to log in',
      });
    });

    it('should handle InvalidShop error', () => {
      const loginErrors: MockLoginError = {
        shop: LoginErrorType.InvalidShop,
      };

      const result = loginErrorMessage(loginErrors as any);

      expect(result).toEqual({
        shop: 'Please enter a valid shop domain to log in',
      });
    });

    it('should return empty object for unknown error types', () => {
      const loginErrors: MockLoginError = {
        shop: 'unknown-error' as any,
      };

      const result = loginErrorMessage(loginErrors as any);

      expect(result).toEqual({});
    });

    it('should return empty object for null errors', () => {
      const result = loginErrorMessage(null as any);
      expect(result).toEqual({});
    });
  });

  describe('error message content', () => {
    it('should provide user-friendly missing shop message', () => {
      const result = loginErrorMessage({ shop: LoginErrorType.MissingShop } as any);
      
      expect(result.shop).toContain('Please enter your shop domain');
      expect(result.shop).toContain('log in');
    });

    it('should provide user-friendly invalid shop message', () => {
      const result = loginErrorMessage({ shop: LoginErrorType.InvalidShop } as any);
      
      expect(result.shop).toContain('Please enter a valid shop domain');
      expect(result.shop).toContain('log in');
    });

    it('should only include shop error field when present', () => {
      const missingShopResult = loginErrorMessage({ shop: LoginErrorType.MissingShop } as any);
      const invalidShopResult = loginErrorMessage({ shop: LoginErrorType.InvalidShop } as any);
      const noErrorResult = loginErrorMessage({});

      expect(Object.keys(missingShopResult)).toEqual(['shop']);
      expect(Object.keys(invalidShopResult)).toEqual(['shop']);
      expect(Object.keys(noErrorResult)).toEqual([]);
    });
  });

  describe('TypeScript interface compliance', () => {
    it('should return LoginErrorMessage interface', () => {
      const result = loginErrorMessage({});
      
      // The result should be an object that can have optional shop property
      expect(typeof result).toBe('object');
      expect(result).not.toBe(null);
    });

    it('should handle shop property correctly', () => {
      const withShopError = loginErrorMessage({ shop: LoginErrorType.MissingShop } as any);
      const withoutShopError = loginErrorMessage({});

      expect(typeof withShopError.shop).toBe('string');
      expect(withoutShopError.shop).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string shop error', () => {
      const result = loginErrorMessage({ shop: '' as any });
      expect(result).toEqual({});
    });

    it('should handle numeric shop error', () => {
      const result = loginErrorMessage({ shop: 123 as any });
      expect(result).toEqual({});
    });

    it('should handle boolean shop error', () => {
      const result = loginErrorMessage({ shop: true as any });
      expect(result).toEqual({});
    });

    it('should handle object with additional properties', () => {
      const loginErrors = {
        shop: LoginErrorType.MissingShop,
        otherProperty: 'some value',
      };

      const result = loginErrorMessage(loginErrors as any);

      expect(result).toEqual({
        shop: 'Please enter your shop domain to log in',
      });
      expect('otherProperty' in result).toBe(false);
    });
  });
});