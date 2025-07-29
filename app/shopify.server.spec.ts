import { ApiVersion, AppDistribution } from '@shopify/shopify-app-remix/server';

// Mock dependencies
jest.mock('@shopify/shopify-app-remix/adapters/node');
jest.mock('@shopify/shopify-app-remix/server', () => ({
  ApiVersion: {
    October24: '2024-10',
  },
  AppDistribution: {
    AppStore: 'app_store',
  },
  shopifyApp: jest.fn().mockReturnValue({
    addDocumentResponseHeaders: jest.fn(),
    authenticate: {
      admin: jest.fn(),
    },
    unauthenticated: jest.fn(),
    login: jest.fn(),
    registerWebhooks: jest.fn(),
    sessionStorage: jest.fn(),
  }),
}));

jest.mock('@shopify/shopify-app-session-storage-prisma', () => ({
  PrismaSessionStorage: jest.fn(),
}));

jest.mock('./db.server', () => ({
  __esModule: true,
  default: {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('shopify.server', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env;
    
    // Set up test environment variables
    process.env = {
      ...originalEnv,
      SHOPIFY_API_KEY: 'test_api_key',
      SHOPIFY_API_SECRET: 'test_api_secret',
      SHOPIFY_API_SCOPES: 'read_products,write_products',
      SHOPIFY_APP_URL: 'https://test-app.example.com',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('shopify app configuration', () => {
    it('should configure shopify app with correct parameters', () => {
      const { shopifyApp } = require('@shopify/shopify-app-remix/server');
      require('./shopify.server');

      expect(shopifyApp).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test_api_key',
          apiSecretKey: 'test_api_secret',
          apiVersion: ApiVersion.October24,
          appUrl: 'https://test-app.example.com',
          authPathPrefix: '/auth',
          distribution: AppDistribution.AppStore,
        })
      );
    });

    it('should handle missing environment variables gracefully', () => {
      delete process.env.SHOPIFY_API_SECRET;
      delete process.env.SHOPIFY_API_SCOPES;
      delete process.env.SHOPIFY_APP_URL;

      const { shopifyApp } = require('@shopify/shopify-app-remix/server');
      
      expect(() => {
        jest.resetModules();
        require('./shopify.server');
      }).not.toThrow();

      expect(shopifyApp).toHaveBeenCalled();
    });

    it('should configure scopes correctly', () => {
      const { shopifyApp } = require('@shopify/shopify-app-remix/server');
      require('./shopify.server');

      const call = shopifyApp.mock.calls[0][0];
      expect(call.scopes).toEqual(expect.arrayContaining(['read_products', 'write_products']));
    });

    it('should include custom shop domain when provided', () => {
      process.env.SHOP_CUSTOM_DOMAIN = 'custom.shop.com';
      
      const { shopifyApp } = require('@shopify/shopify-app-remix/server');
      jest.resetModules();
      require('./shopify.server');

      const call = shopifyApp.mock.calls[0][0];
      expect(call.customShopDomains).toEqual(['custom.shop.com']);
    });
  });

  describe('exported functions', () => {
    it('should export default shopify app instance', () => {
      const shopify = require('./shopify.server').default;
      expect(shopify).toBeDefined();
    });

    it('should export apiVersion', () => {
      const { apiVersion } = require('./shopify.server');
      expect(apiVersion).toBe(ApiVersion.October24);
    });

    it('should export authenticate function', () => {
      const { authenticate } = require('./shopify.server');
      expect(authenticate).toBeDefined();
    });

    it('should export unauthenticated function', () => {
      const { unauthenticated } = require('./shopify.server');
      expect(unauthenticated).toBeDefined();
    });

    it('should export login function', () => {
      const { login } = require('./shopify.server');
      expect(login).toBeDefined();
    });

    it('should export registerWebhooks function', () => {
      const { registerWebhooks } = require('./shopify.server');
      expect(registerWebhooks).toBeDefined();
    });

    it('should export sessionStorage', () => {
      const { sessionStorage } = require('./shopify.server');
      expect(sessionStorage).toBeDefined();
    });

    it('should export addDocumentResponseHeaders', () => {
      const { addDocumentResponseHeaders } = require('./shopify.server');
      expect(addDocumentResponseHeaders).toBeDefined();
    });
  });

  describe('session storage configuration', () => {
    it('should use PrismaSessionStorage', () => {
      const { PrismaSessionStorage } = require('@shopify/shopify-app-session-storage-prisma');
      
      jest.resetModules();
      require('./shopify.server');
      
      expect(PrismaSessionStorage).toHaveBeenCalled();
    });
  });

  describe('future flags', () => {
    it('should enable future flags correctly', () => {
      const { shopifyApp } = require('@shopify/shopify-app-remix/server');
      jest.resetModules();
      require('./shopify.server');

      const call = shopifyApp.mock.calls[0][0];
      expect(call.future).toEqual({
        unstable_newEmbeddedAuthStrategy: true,
        removeRest: true,
      });
    });
  });
});