import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QRCodeGenerator from './app.qrcode-generator';

// Mock QRCodeSVG component
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size }: { value: string; size: number }) => (
    <div data-testid="qrcode" data-value={value} data-size={size}>
      QR Code for: {value}
    </div>
  ),
}));

// Mock Shopify Polaris components
jest.mock('@shopify/polaris', () => ({
  Page: ({ children }: any) => <div data-testid="page">{children}</div>,
  Layout: ({ children }: any) => <div data-testid="layout">{children}</div>,
  TextField: ({ value, onChange, label, multiline }: any) => (
    <div>
      <label>{label}</label>
      {multiline ? (
        <textarea
          data-testid={`textfield-${label?.toLowerCase().replace(/\s+/g, '-')}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
        />
      ) : (
        <input
          data-testid={`textfield-${label?.toLowerCase().replace(/\s+/g, '-')}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
        />
      )}
    </div>
  ),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  Button: ({ children, onClick, disabled }: any) => (
    <button data-testid="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Select: ({ value, onChange, options, label }: any) => (
    <div>
      <label>{label}</label>
      <select
        data-testid={`select-${label?.toLowerCase().replace(/\s+/g, '-')}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options?.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  ),
  BlockStack: ({ children }: any) => <div data-testid="blockstack">{children}</div>,
}));

// Mock window.open for print functionality
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen,
});

describe('QRCode Generator Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock print window
    mockWindowOpen.mockReturnValue({
      document: {
        write: jest.fn(),
        close: jest.fn(),
      },
      focus: jest.fn(),
      print: jest.fn(),
      close: jest.fn(),
    });
  });

  describe('Component rendering', () => {
    it('should render main page elements', () => {
      render(<QRCodeGenerator />);

      expect(screen.getByTestId('page')).toBeInTheDocument();
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getAllByTestId('card')).toHaveLength(2); // Control card and preview card
    });

    it('should render input fields', () => {
      render(<QRCodeGenerator />);

      expect(screen.getByTestId('textfield-tags-(one-per-line)')).toBeInTheDocument();
      expect(screen.getByTestId('textfield-url-prefix')).toBeInTheDocument();
    });

    it('should render control buttons', () => {
      render(<QRCodeGenerator />);

      const buttons = screen.getAllByTestId('button');
      const generateButton = buttons.find(btn => btn.textContent === 'Generate QR Codes');
      const printButton = buttons.find(btn => btn.textContent === 'Print QR Codes');

      expect(generateButton).toBeInTheDocument();
      expect(printButton).toBeInTheDocument();
    });

    it('should render layout controls', () => {
      render(<QRCodeGenerator />);

      expect(screen.getByTestId('select-qr-codes-per-row')).toBeInTheDocument();
      expect(screen.getByTestId('select-font-size')).toBeInTheDocument();
    });
  });

  describe('QR Code generation', () => {
    it('should generate QR codes from tag input', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const tagsInput = screen.getByTestId('textfield-tags-(one-per-line)');
      const generateButton = screen.getByText('Generate QR Codes');

      await user.type(tagsInput, 'tag1\ntag2\ntag3');
      await user.click(generateButton);

      // Check that QR codes are generated
      expect(screen.getAllByTestId('qrcode')).toHaveLength(3);
    });

    it('should handle URL prefix in QR code generation', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const tagsInput = screen.getByTestId('textfield-tags-(one-per-line)');
      const urlPrefixInput = screen.getByTestId('textfield-url-prefix');
      const generateButton = screen.getByText('Generate QR Codes');

      await user.type(urlPrefixInput, 'https://example.com/?tag=');
      await user.type(tagsInput, 'test-tag');
      await user.click(generateButton);

      const qrCode = screen.getByTestId('qrcode');
      expect(qrCode).toHaveAttribute('data-value', 'https://example.com/?tag=test-tag');
    });

    it('should filter out empty tags', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const tagsInput = screen.getByTestId('textfield-tags-(one-per-line)');
      const generateButton = screen.getByText('Generate QR Codes');

      await user.type(tagsInput, 'tag1\n\n  \ntag2\n');
      await user.click(generateButton);

      // Should only generate QR codes for non-empty tags
      expect(screen.getAllByTestId('qrcode')).toHaveLength(2);
    });

    it('should handle tags without URL prefix', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const tagsInput = screen.getByTestId('textfield-tags-(one-per-line)');
      const generateButton = screen.getByText('Generate QR Codes');

      await user.type(tagsInput, 'plain-tag');
      await user.click(generateButton);

      const qrCode = screen.getByTestId('qrcode');
      expect(qrCode).toHaveAttribute('data-value', 'plain-tag');
    });
  });

  describe('Layout controls', () => {
    it('should allow changing QR codes per row', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const perRowSelect = screen.getByTestId('select-qr-codes-per-row');
      
      await user.selectOptions(perRowSelect, '5');
      expect(perRowSelect).toHaveValue('5');
    });

    it('should allow changing font size', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const fontSizeSelect = screen.getByTestId('select-font-size');
      
      await user.selectOptions(fontSizeSelect, '16');
      expect(fontSizeSelect).toHaveValue('16');
    });

    it('should have default layout values', () => {
      render(<QRCodeGenerator />);

      const perRowSelect = screen.getByTestId('select-qr-codes-per-row');
      const fontSizeSelect = screen.getByTestId('select-font-size');

      expect(perRowSelect).toHaveValue('3');
      expect(fontSizeSelect).toHaveValue('12');
    });
  });

  describe('Print functionality', () => {
    it('should open print window when print button clicked', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      // Generate some QR codes first
      const tagsInput = screen.getByTestId('textfield-tags-(one-per-line)');
      const generateButton = screen.getByText('Generate QR Codes');
      await user.type(tagsInput, 'test-tag');
      await user.click(generateButton);

      const printButton = screen.getByText('Print QR Codes');
      await user.click(printButton);

      expect(mockWindowOpen).toHaveBeenCalledWith('', 'PRINT', 'height=600,width=800');
    });

    it('should handle print button when no QR codes generated', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const printButton = screen.getByText('Print QR Codes');
      await user.click(printButton);

      // Should still attempt to open print window
      expect(mockWindowOpen).toHaveBeenCalled();
    });

    it('should handle print window opening failure', async () => {
      const user = userEvent.setup();
      mockWindowOpen.mockReturnValue(null);
      
      render(<QRCodeGenerator />);

      const printButton = screen.getByText('Print QR Codes');
      
      expect(() => user.click(printButton)).not.toThrow();
    });
  });

  describe('QR Code display', () => {
    it('should display QR codes with proper styling', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const tagsInput = screen.getByTestId('textfield-tags-(one-per-line)');
      const generateButton = screen.getByText('Generate QR Codes');

      await user.type(tagsInput, 'styled-tag');
      await user.click(generateButton);

      const qrCode = screen.getByTestId('qrcode');
      expect(qrCode).toBeInTheDocument();
      expect(qrCode).toHaveAttribute('data-size', '150'); // Default QR code size
    });

    it('should show tag text below QR codes', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const tagsInput = screen.getByTestId('textfield-tags-(one-per-line)');
      const generateButton = screen.getByText('Generate QR Codes');

      await user.type(tagsInput, 'labeled-tag');
      await user.click(generateButton);

      // The tag text should be visible in the component
      expect(screen.getByText('labeled-tag')).toBeInTheDocument();
    });
  });

  describe('Input validation', () => {
    it('should handle special characters in tags', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const tagsInput = screen.getByTestId('textfield-tags-(one-per-line)');
      const generateButton = screen.getByText('Generate QR Codes');

      await user.type(tagsInput, 'tag@special#chars$%');
      await user.click(generateButton);

      const qrCode = screen.getByTestId('qrcode');
      expect(qrCode).toHaveAttribute('data-value', 'tag@special#chars$%');
    });

    it('should handle whitespace trimming', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const tagsInput = screen.getByTestId('textfield-tags-(one-per-line)');
      const generateButton = screen.getByText('Generate QR Codes');

      await user.type(tagsInput, '  trimmed-tag  ');
      await user.click(generateButton);

      const qrCode = screen.getByTestId('qrcode');
      expect(qrCode).toHaveAttribute('data-value', 'trimmed-tag');
    });

    it('should handle long tag lists', async () => {
      const user = userEvent.setup();
      render(<QRCodeGenerator />);

      const tagsInput = screen.getByTestId('textfield-tags-(one-per-line)');
      const generateButton = screen.getByText('Generate QR Codes');

      const manyTags = Array.from({ length: 10 }, (_, i) => `tag${i + 1}`).join('\n');
      await user.type(tagsInput, manyTags);
      await user.click(generateButton);

      expect(screen.getAllByTestId('qrcode')).toHaveLength(10);
    });
  });
});