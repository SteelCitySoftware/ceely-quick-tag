import {
  downloadCSVFile,
  getInvoiceCSVRows,
  getProductsCSVRows,
  sanitizeFilename,
  invoiceCSVHeaders,
  productsCSVHeaders,
} from './csvExport';

// Mock DOM methods for testing
const mockCreateElement = jest.fn();
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  
  // Mock DOM
  mockCreateElement.mockReturnValue({
    href: '',
    download: '',
    click: jest.fn(),
  });
  
  global.document.createElement = mockCreateElement;
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
  global.Blob = jest.fn();
});

describe('csvExport utilities', () => {
  describe('downloadCSVFile', () => {
    it('should create and download a CSV file', () => {
      const headers = ['Name', 'Age'];
      const rows = [['John', 30], ['Jane', 25]];
      const filename = 'test.csv';

      downloadCSVFile(headers, rows, filename);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(global.Blob).toHaveBeenCalled();
    });

    it('should handle empty data', () => {
      const headers = ['Name'];
      const rows: (string | number)[][] = [];
      const filename = 'empty.csv';

      expect(() => downloadCSVFile(headers, rows, filename)).not.toThrow();
    });
  });

  describe('getInvoiceCSVRows', () => {
    const mockOrder = {
      name: 'ORDER001',
      customer: 'Test Customer',
      createdAt: '2024-01-01T00:00:00Z',
      lineItems: [
        {
          title: 'Test Product',
          quantity: 2,
          rate: 10.50,
          sku: 'TEST-SKU',
          category: 'Electronics',
        },
      ],
      poNumber: 'PO123',
    };

    it('should generate invoice CSV rows from order data', () => {
      const rows = getInvoiceCSVRows(mockOrder);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain('ORDER001');
      expect(rows[0]).toContain('Test Customer');
      expect(rows[0]).toContain('Test Product');
      expect(rows[0]).toContain(2);
      expect(rows[0]).toContain('10.50');
      expect(rows[0]).toContain('21.00'); // quantity * rate
    });

    it('should handle multiple line items', () => {
      const orderWithMultipleItems = {
        ...mockOrder,
        lineItems: [
          mockOrder.lineItems[0],
          {
            title: 'Another Product',
            quantity: 1,
            rate: 5.00,
            sku: 'ANOTHER-SKU',
            category: 'Books',
          },
        ],
      };

      const rows = getInvoiceCSVRows(orderWithMultipleItems);
      expect(rows).toHaveLength(2);
    });
  });

  describe('getProductsCSVRows', () => {
    const mockOrder = {
      name: 'ORDER001',
      customer: 'Test Customer',
      createdAt: '2024-01-01T00:00:00Z',
      lineItems: [
        {
          title: 'Test Product',
          quantity: 2,
          rate: 10.50,
          sku: 'TEST-SKU',
          category: 'Electronics',
        },
      ],
    };

    it('should generate products CSV rows from order data', () => {
      const rows = getProductsCSVRows(mockOrder);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain('Test Product');
      expect(rows[0]).toContain('Non‑inventory');
      expect(rows[0]).toContain('TEST-SKU');
      expect(rows[0]).toContain('10.50');
      expect(rows[0]).toContain('Electronics');
    });

    it('should handle missing SKU and category', () => {
      const orderWithMissingData = {
        ...mockOrder,
        lineItems: [
          {
            title: 'Product Without SKU',
            quantity: 1,
            rate: 15.00,
            sku: '',
            category: '',
          },
        ],
      };

      const rows = getProductsCSVRows(orderWithMissingData);
      expect(rows[0]).toContain('');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove special characters from filename', () => {
      const input = 'test@file#name.csv';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('testfilenamecsv');
      expect(result).not.toContain('@');
      expect(result).not.toContain('#');
    });

    it('should preserve alphanumeric characters, spaces, and dashes', () => {
      const input = 'test file-name 123';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('test file-name 123');
    });

    it('should trim whitespace', () => {
      const input = '  test file  ';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('test file');
    });
  });

  describe('CSV headers', () => {
    it('should have correct invoice CSV headers', () => {
      expect(invoiceCSVHeaders).toContain('InvoiceNo');
      expect(invoiceCSVHeaders).toContain('Customer');
      expect(invoiceCSVHeaders).toContain('ItemQuantity');
      expect(invoiceCSVHeaders).toContain('*ItemAmount');
    });

    it('should have correct products CSV headers', () => {
      expect(productsCSVHeaders).toContain('Product/Service Name');
      expect(productsCSVHeaders).toContain('Type');
      expect(productsCSVHeaders).toContain('SKU');
      expect(productsCSVHeaders).toContain('Sales price');
    });
  });
});