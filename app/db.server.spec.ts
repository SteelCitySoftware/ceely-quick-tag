import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  })),
}));

describe('db.server', () => {
  let originalEnv: string | undefined;
  let mockPrismaInstance: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env.NODE_ENV;
    
    mockPrismaInstance = new PrismaClient() as jest.Mocked<PrismaClient>;
    
    // Clear global prisma
    delete (global as any).prisma;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  describe('database client initialization', () => {
    it('should initialize PrismaClient in development environment', () => {
      process.env.NODE_ENV = 'development';
      
      // Re-import module to test initialization
      require('./db.server');
      
      expect(PrismaClient).toHaveBeenCalled();
    });

    it('should initialize PrismaClient in production environment', () => {
      process.env.NODE_ENV = 'production';
      
      // Re-import module to test initialization
      require('./db.server');
      
      expect(PrismaClient).toHaveBeenCalled();
    });

    it('should reuse global prisma instance in non-production environment', () => {
      process.env.NODE_ENV = 'development';
      
      // Set global prisma
      (global as any).prisma = mockPrismaInstance;
      
      const db = require('./db.server').default;
      
      expect(db).toBe(mockPrismaInstance);
    });
  });

  describe('prisma client instance', () => {
    it('should export a valid prisma client instance', () => {
      const db = require('./db.server').default;
      
      expect(db).toBeDefined();
      expect(db).toBeInstanceOf(PrismaClient);
    });

    it('should be available as default export', () => {
      const db = require('./db.server').default;
      
      expect(db).toBeTruthy();
    });
  });

  describe('global prisma handling', () => {
    it('should store prisma instance globally in non-production', () => {
      process.env.NODE_ENV = 'development';
      
      // Import fresh module
      jest.resetModules();
      require('./db.server');
      
      expect((global as any).prisma).toBeDefined();
    });

    it('should not rely on global in production', () => {
      process.env.NODE_ENV = 'production';
      
      // Clear global
      delete (global as any).prisma;
      
      jest.resetModules();
      const db = require('./db.server').default;
      
      expect(db).toBeDefined();
    });
  });
});