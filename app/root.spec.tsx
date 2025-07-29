import { render, screen } from '@testing-library/react';
import { createRemixStub } from '@remix-run/testing';
import AppRoot from './root';

// Mock Shopify Polaris styles
jest.mock('@shopify/polaris/build/esm/styles.css', () => ({}));

// Mock Shopify Polaris components
jest.mock('@shopify/polaris', () => ({
  AppProvider: ({ children, i18n }: any) => (
    <div data-testid="app-provider" data-i18n={JSON.stringify(i18n)}>
      {children}
    </div>
  ),
}));

// Mock Remix components
jest.mock('@remix-run/react', () => ({
  Links: () => <div data-testid="links" />,
  Meta: () => <div data-testid="meta" />,
  Outlet: () => <div data-testid="outlet">Content</div>,
  Scripts: () => <div data-testid="scripts" />,
  ScrollRestoration: () => <div data-testid="scroll-restoration" />,
}));

describe('Root App Component', () => {
  describe('HTML structure', () => {
    it('should render proper HTML document structure', () => {
      render(<AppRoot />);

      // Check for HTML elements
      expect(document.querySelector('html')).toBeInTheDocument();
      expect(document.querySelector('head')).toBeInTheDocument();
      expect(document.querySelector('body')).toBeInTheDocument();
    });

    it('should include required meta tags', () => {
      render(<AppRoot />);

      const charsetMeta = document.querySelector('meta[charset="utf-8"]');
      const viewportMeta = document.querySelector('meta[name="viewport"]');

      expect(charsetMeta).toBeInTheDocument();
      expect(viewportMeta).toBeInTheDocument();
      expect(viewportMeta?.getAttribute('content')).toBe('width=device-width,initial-scale=1');
    });

    it('should include Shopify font preconnect', () => {
      render(<AppRoot />);

      const preconnectLink = document.querySelector('link[rel="preconnect"][href="https://cdn.shopify.com/"]');
      expect(preconnectLink).toBeInTheDocument();
    });

    it('should include Inter font stylesheet', () => {
      render(<AppRoot />);

      const fontLink = document.querySelector('link[href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"]');
      expect(fontLink).toBeInTheDocument();
    });
  });

  describe('Remix components', () => {
    it('should render Remix Meta component', () => {
      render(<AppRoot />);

      expect(screen.getByTestId('meta')).toBeInTheDocument();
    });

    it('should render Remix Links component', () => {
      render(<AppRoot />);

      expect(screen.getByTestId('links')).toBeInTheDocument();
    });

    it('should render Remix Outlet component', () => {
      render(<AppRoot />);

      expect(screen.getByTestId('outlet')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should render Remix Scripts component', () => {
      render(<AppRoot />);

      expect(screen.getByTestId('scripts')).toBeInTheDocument();
    });

    it('should render ScrollRestoration component', () => {
      render(<AppRoot />);

      expect(screen.getByTestId('scroll-restoration')).toBeInTheDocument();
    });
  });

  describe('Shopify Polaris integration', () => {
    it('should render AppProvider with i18n configuration', () => {
      render(<AppRoot />);

      const appProvider = screen.getByTestId('app-provider');
      expect(appProvider).toBeInTheDocument();

      const i18nData = JSON.parse(appProvider.getAttribute('data-i18n') || '{}');
      expect(i18nData).toEqual({
        en: {
          Polaris: {
            Common: {
              yes: 'Yes',
              no: 'No',
            },
          },
        },
      });
    });

    it('should wrap Outlet in AppProvider', () => {
      render(<AppRoot />);

      const appProvider = screen.getByTestId('app-provider');
      const outlet = screen.getByTestId('outlet');

      expect(appProvider).toContainElement(outlet);
    });
  });

  describe('i18n configuration', () => {
    it('should define English translations for common terms', () => {
      render(<AppRoot />);

      const appProvider = screen.getByTestId('app-provider');
      const i18nData = JSON.parse(appProvider.getAttribute('data-i18n') || '{}');

      expect(i18nData.en.Polaris.Common.yes).toBe('Yes');
      expect(i18nData.en.Polaris.Common.no).toBe('No');
    });

    it('should have properly structured i18n object', () => {
      render(<AppRoot />);

      const appProvider = screen.getByTestId('app-provider');
      const i18nData = JSON.parse(appProvider.getAttribute('data-i18n') || '{}');

      expect(i18nData).toHaveProperty('en');
      expect(i18nData.en).toHaveProperty('Polaris');
      expect(i18nData.en.Polaris).toHaveProperty('Common');
    });
  });

  describe('integration with Remix routing', () => {
    it('should work with Remix routing system', () => {
      const RemixStub = createRemixStub([
        {
          path: '/',
          Component: () => <div>Test Route</div>,
        },
      ]);

      render(
        <RemixStub>
          <AppRoot />
        </RemixStub>
      );

      // Should work without errors
      expect(document.querySelector('html')).toBeInTheDocument();
    });
  });

  describe('external resources', () => {
    it('should properly link to Shopify CDN resources', () => {
      render(<AppRoot />);

      const preconnect = document.querySelector('link[rel="preconnect"]');
      const fontLink = document.querySelector('link[href*="cdn.shopify.com"]');

      expect(preconnect?.getAttribute('href')).toBe('https://cdn.shopify.com/');
      expect(fontLink?.getAttribute('href')).toContain('cdn.shopify.com');
    });

    it('should reference Inter font family', () => {
      render(<AppRoot />);

      const fontLink = document.querySelector('link[href*="inter"]');
      expect(fontLink).toBeInTheDocument();
      expect(fontLink?.getAttribute('href')).toContain('inter/v4/styles.css');
    });
  });

  describe('accessibility', () => {
    it('should have proper viewport meta tag for mobile accessibility', () => {
      render(<AppRoot />);

      const viewportMeta = document.querySelector('meta[name="viewport"]');
      expect(viewportMeta?.getAttribute('content')).toContain('width=device-width');
      expect(viewportMeta?.getAttribute('content')).toContain('initial-scale=1');
    });

    it('should have UTF-8 charset for proper text encoding', () => {
      render(<AppRoot />);

      const charsetMeta = document.querySelector('meta[charset]');
      expect(charsetMeta?.getAttribute('charset')).toBe('utf-8');
    });
  });

  describe('performance', () => {
    it('should preconnect to Shopify CDN for faster resource loading', () => {
      render(<AppRoot />);

      const preconnectLink = document.querySelector('link[rel="preconnect"]');
      expect(preconnectLink).toBeInTheDocument();
      expect(preconnectLink?.getAttribute('href')).toBe('https://cdn.shopify.com/');
    });

    it('should load Inter font from Shopify CDN', () => {
      render(<AppRoot />);

      const fontLink = document.querySelector('link[href*="fonts/inter"]');
      expect(fontLink).toBeInTheDocument();
      expect(fontLink?.getAttribute('rel')).toBe('stylesheet');
    });
  });
});