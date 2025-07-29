import { action } from './webhooks.app.uninstalled';

// Mock dependencies
jest.mock('../shopify.server', () => ({
  authenticate: {
    webhook: jest.fn(),
  },
}));

jest.mock('../db.server', () => ({
  session: {
    deleteMany: jest.fn(),
  },
}));

describe('Webhooks App Uninstalled Route', () => {
  let mockAuthenticate: jest.Mock;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAuthenticate = require('../shopify.server').authenticate.webhook;
    mockDb = require('../db.server');
  });

  describe('action function', () => {
    it('should authenticate webhook request', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
        headers: {
          'X-Shopify-Topic': 'app/uninstalled',
          'X-Shopify-Shop-Domain': 'test-shop.myshopify.com',
        },
      });

      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: { id: 'session-123' },
        topic: 'app/uninstalled',
      });

      await action({ request: mockRequest } as any);

      expect(mockAuthenticate).toHaveBeenCalledWith(mockRequest);
    });

    it('should delete sessions when session exists', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      const mockSession = { id: 'session-123', shop: 'test-shop.myshopify.com' };
      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: mockSession,
        topic: 'app/uninstalled',
      });

      mockDb.session.deleteMany.mockResolvedValue({ count: 1 });

      await action({ request: mockRequest } as any);

      expect(mockDb.session.deleteMany).toHaveBeenCalledWith({
        where: { shop: 'test-shop.myshopify.com' }
      });
    });

    it('should not delete sessions when session is null', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: null,
        topic: 'app/uninstalled',
      });

      await action({ request: mockRequest } as any);

      expect(mockDb.session.deleteMany).not.toHaveBeenCalled();
    });

    it('should return empty Response', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: { id: 'session-123' },
        topic: 'app/uninstalled',
      });

      const response = await action({ request: mockRequest } as any);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });

    it('should handle authentication errors', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      mockAuthenticate.mockRejectedValue(new Error('Authentication failed'));

      await expect(action({ request: mockRequest } as any)).rejects.toThrow('Authentication failed');
    });

    it('should handle database errors gracefully', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: { id: 'session-123' },
        topic: 'app/uninstalled',
      });

      mockDb.session.deleteMany.mockRejectedValue(new Error('Database error'));

      await expect(action({ request: mockRequest } as any)).rejects.toThrow('Database error');
    });

    it('should log webhook receipt', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: null,
        topic: 'app/uninstalled',
      });

      await action({ request: mockRequest } as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Received app/uninstalled webhook for test-shop.myshopify.com'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('webhook handling', () => {
    it('should handle multiple webhook calls for same shop', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: { id: 'session-123' },
        topic: 'app/uninstalled',
      });

      // First call
      await action({ request: mockRequest } as any);
      
      // Second call (session might be null this time)
      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: null,
        topic: 'app/uninstalled',
      });

      await action({ request: mockRequest } as any);

      // Should only call deleteMany once (when session exists)
      expect(mockDb.session.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('should handle different shop domains', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      const shops = ['shop1.myshopify.com', 'shop2.myshopify.com'];

      for (const shop of shops) {
        mockAuthenticate.mockResolvedValue({
          shop,
          session: { id: `session-${shop}` },
          topic: 'app/uninstalled',
        });

        await action({ request: mockRequest } as any);

        expect(mockDb.session.deleteMany).toHaveBeenCalledWith({
          where: { shop }
        });
      }

      expect(mockDb.session.deleteMany).toHaveBeenCalledTimes(2);
    });

    it('should handle webhook topics correctly', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: { id: 'session-123' },
        topic: 'app/uninstalled',
      });

      await action({ request: mockRequest } as any);

      // Verify that the topic is handled correctly in the log
      const consoleSpy = jest.spyOn(console, 'log');
      
      await action({ request: mockRequest } as any);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('app/uninstalled')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('response handling', () => {
    it('should return successful response status', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: null,
        topic: 'app/uninstalled',
      });

      const response = await action({ request: mockRequest } as any);

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    it('should return empty response body', async () => {
      const mockRequest = new Request('http://localhost/webhooks/app/uninstalled', {
        method: 'POST',
      });

      mockAuthenticate.mockResolvedValue({
        shop: 'test-shop.myshopify.com',
        session: null,
        topic: 'app/uninstalled',
      });

      const response = await action({ request: mockRequest } as any);
      const body = await response.text();

      expect(body).toBe('');
    });
  });
});