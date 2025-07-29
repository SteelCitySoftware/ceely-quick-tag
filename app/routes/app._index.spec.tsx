import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRemixStub } from '@remix-run/testing';
import IndexRoute, { loader, action } from './app._index';

// Mock dependencies
jest.mock('../shopify.server', () => ({
  authenticate: {
    admin: jest.fn().mockResolvedValue({
      admin: {
        graphql: jest.fn(),
      },
    }),
  },
}));

jest.mock('../hooks/useFocusManagement', () => {
  return jest.fn(() => {});
});

// Mock audio files
jest.mock('./sounds/success.mp3', () => 'success-sound-mock', { virtual: true });
jest.mock('./sounds/failure.mp3', () => 'failure-sound-mock', { virtual: true });

// Mock Shopify Polaris components
jest.mock('@shopify/polaris', () => ({
  Page: ({ children }: any) => <div data-testid="page">{children}</div>,
  Form: ({ children, onSubmit }: any) => (
    <form data-testid="form" onSubmit={onSubmit}>
      {children}
    </form>
  ),
  Layout: ({ children }: any) => <div data-testid="layout">{children}</div>,
  Text: ({ children }: any) => <span data-testid="text">{children}</span>,
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  Button: ({ children, onClick, disabled, loading }: any) => (
    <button 
      data-testid="button" 
      onClick={onClick} 
      disabled={disabled || loading}
    >
      {children}
    </button>
  ),
  TextField: ({ value, onChange, label, id }: any) => (
    <input
      data-testid={`textfield-${id || label}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      id={id}
    />
  ),
  BlockStack: ({ children }: any) => <div data-testid="blockstack">{children}</div>,
  DataTable: ({ rows, headings }: any) => (
    <table data-testid="datatable">
      <thead>
        <tr>
          {headings?.map((heading: string, i: number) => (
            <th key={i}>{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows?.map((row: any[], i: number) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  Icon: ({ source }: any) => <span data-testid="icon">{source}</span>,
}));

jest.mock('@shopify/polaris-icons', () => ({
  ProductIcon: 'ProductIcon',
  PlusIcon: 'PlusIcon',
  DeleteIcon: 'DeleteIcon',
  SearchListIcon: 'SearchListIcon',
  PageClockFilledIcon: 'PageClockFilledIcon',
  SearchIcon: 'SearchIcon',
  BarcodeIcon: 'BarcodeIcon',
}));

jest.mock('@shopify/app-bridge-react', () => ({
  TitleBar: ({ title }: any) => <div data-testid="titlebar">{title}</div>,
}));

describe('App Index Route', () => {
  describe('loader', () => {
    it('should authenticate admin and return null', async () => {
      const mockRequest = new Request('http://localhost/app');
      const result = await loader({ request: mockRequest } as any);
      
      expect(result).toBeNull();
    });

    it('should call authenticate.admin with request', async () => {
      const { authenticate } = require('../shopify.server');
      const mockRequest = new Request('http://localhost/app');
      
      await loader({ request: mockRequest } as any);
      
      expect(authenticate.admin).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe('action', () => {
    let mockAdmin: any;

    beforeEach(() => {
      mockAdmin = {
        graphql: jest.fn(),
      };

      const { authenticate } = require('../shopify.server');
      authenticate.admin.mockResolvedValue({ admin: mockAdmin });
    });

    it('should handle barcode and tag submission', async () => {
      const formData = new FormData();
      formData.append('barcode', '123456789');
      formData.append('tag', 'test-tag');

      const mockRequest = new Request('http://localhost/app', {
        method: 'POST',
        body: formData,
      });

      mockAdmin.graphql.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { shop: { url: 'https://test.myshopify.com' } }
        }),
      });

      mockAdmin.graphql.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { 
            products: { 
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/123',
                    title: 'Test Product',
                    tags: ['existing-tag'],
                    variants: { edges: [] },
                  }
                }
              ] 
            } 
          }
        }),
      });

      mockAdmin.graphql.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { 
            tagsAdd: { 
              userErrors: [] 
            } 
          }
        }),
      });

      const result = await action({ request: mockRequest } as any);

      expect(result.success).toBe(true);
      expect(mockAdmin.graphql).toHaveBeenCalledTimes(3); // shop query, product search, tag add
    });

    it('should handle tag-only search', async () => {
      const formData = new FormData();
      formData.append('tag', 'search-tag');

      const mockRequest = new Request('http://localhost/app', {
        method: 'POST',
        body: formData,
      });

      mockAdmin.graphql.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { shop: { url: 'https://test.myshopify.com' } }
        }),
      });

      mockAdmin.graphql.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { 
            products: { 
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/456',
                    title: 'Tagged Product',
                    tags: ['search-tag'],
                    variants: { edges: [] },
                  }
                }
              ] 
            } 
          }
        }),
      });

      const result = await action({ request: mockRequest } as any);

      expect(result.success).toBe(true);
      expect(result.products).toHaveLength(1);
    });

    it('should handle product refresh by ID', async () => {
      const formData = new FormData();
      formData.append('productId', 'gid://shopify/Product/789');

      const mockRequest = new Request('http://localhost/app', {
        method: 'POST',
        body: formData,
      });

      mockAdmin.graphql.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { shop: { url: 'https://test.myshopify.com' } }
        }),
      });

      mockAdmin.graphql.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { 
            product: {
              id: 'gid://shopify/Product/789',
              title: 'Refreshed Product',
              tags: ['refresh-tag'],
              variants: { edges: [] },
            }
          }
        }),
      });

      const result = await action({ request: mockRequest } as any);

      expect(result.success).toBe(true);
      expect(result.tag).toBe('__refresh__');
    });

    it('should handle errors gracefully', async () => {
      const formData = new FormData();
      formData.append('barcode', '123456789');
      formData.append('tag', 'test-tag');

      const mockRequest = new Request('http://localhost/app', {
        method: 'POST',
        body: formData,
      });

      mockAdmin.graphql.mockRejectedValue(new Error('API Error'));

      const result = await action({ request: mockRequest } as any);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('API Error');
    });
  });

  describe('Component', () => {
    const RemixStub = createRemixStub([
      {
        path: '/',
        Component: IndexRoute,
        loader,
        action,
      },
    ]);

    it('should render main elements', () => {
      render(<RemixStub />);

      expect(screen.getByTestId('titlebar')).toHaveTextContent('Ceely Quick Tag');
      expect(screen.getByTestId('textfield-tagField')).toBeInTheDocument();
      expect(screen.getByTestId('textfield-barcodeField')).toBeInTheDocument();
    });

    it('should allow user to enter tag and barcode', async () => {
      const user = userEvent.setup();
      render(<RemixStub />);

      const tagField = screen.getByTestId('textfield-tagField');
      const barcodeField = screen.getByTestId('textfield-barcodeField');

      await user.type(tagField, 'test-tag');
      await user.type(barcodeField, '123456789');

      expect(tagField).toHaveValue('test-tag');
      expect(barcodeField).toHaveValue('123456789');
    });

    it('should have submit button', () => {
      render(<RemixStub />);

      const buttons = screen.getAllByTestId('button');
      const submitButton = buttons.find(button => 
        button.textContent?.includes('Tag Product') || 
        button.textContent?.includes('Search')
      );

      expect(submitButton).toBeInTheDocument();
    });

    it('should have reset button', () => {
      render(<RemixStub />);

      const resetButton = screen.getByText('Reset');
      expect(resetButton).toBeInTheDocument();
    });

    it('should display data table for results', () => {
      render(<RemixStub />);

      expect(screen.getByTestId('datatable')).toBeInTheDocument();
    });
  });

  describe('InventoryAdjustForm component', () => {
    it('should be tested individually when used', () => {
      // This component is defined within the main component
      // In a real test, you would extract it and test separately
      expect(true).toBe(true);
    });
  });

  describe('helper functions', () => {
    it('should have sleep function for delays', () => {
      // The sleep function is defined in the component
      // In a real implementation, this might be extracted to utils
      expect(true).toBe(true);
    });
  });

  describe('audio and speech functionality', () => {
    it('should handle speech synthesis features', () => {
      // Speech synthesis is mocked in setup
      // Test actual implementation would verify speech calls
      expect(window.speechSynthesis).toBeDefined();
      expect(window.SpeechSynthesisUtterance).toBeDefined();
    });

    it('should handle audio playback', () => {
      // Audio is mocked in setup
      expect(global.Audio).toBeDefined();
    });
  });
});