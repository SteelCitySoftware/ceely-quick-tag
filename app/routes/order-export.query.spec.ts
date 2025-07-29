import { getOrderByQuery } from './order-export.query';

describe('order-export.query', () => {
  describe('getOrderByQuery', () => {
    it('should be a valid GraphQL query string', () => {
      expect(typeof getOrderByQuery).toBe('string');
      expect(getOrderByQuery).toContain('query getOrderByQuery');
      expect(getOrderByQuery).toContain('$query: String!');
    });

    it('should include required order fields', () => {
      expect(getOrderByQuery).toContain('id');
      expect(getOrderByQuery).toContain('name');
      expect(getOrderByQuery).toContain('createdAt');
      expect(getOrderByQuery).toContain('customer');
    });

    it('should include customer information fields', () => {
      expect(getOrderByQuery).toContain('displayName');
      expect(getOrderByQuery).toContain('quickbooksName: metafield');
      expect(getOrderByQuery).toContain('namespace: "custom"');
      expect(getOrderByQuery).toContain('key: "quickbooks_name"');
    });

    it('should include line items with required fields', () => {
      expect(getOrderByQuery).toContain('lineItems(first: 100)');
      expect(getOrderByQuery).toContain('title');
      expect(getOrderByQuery).toContain('quantity');
      expect(getOrderByQuery).toContain('originalUnitPriceSet');
      expect(getOrderByQuery).toContain('shopMoney');
      expect(getOrderByQuery).toContain('amount');
    });

    it('should include variant and product information', () => {
      expect(getOrderByQuery).toContain('variant');
      expect(getOrderByQuery).toContain('sku');
      expect(getOrderByQuery).toContain('product');
      expect(getOrderByQuery).toContain('productType');
    });

    it('should include customer PO number metafield', () => {
      expect(getOrderByQuery).toContain('customerPONumber: metafield');
      expect(getOrderByQuery).toContain('key: "customer_po_number"');
    });

    it('should limit orders to first result', () => {
      expect(getOrderByQuery).toContain('orders(first: 1');
    });

    it('should use proper GraphQL syntax', () => {
      // Check for proper GraphQL structure
      expect(getOrderByQuery).toMatch(/#graphql/);
      expect(getOrderByQuery).toContain('query getOrderByQuery(');
      expect(getOrderByQuery).toContain(') {');
      expect(getOrderByQuery).toMatch(/}\s*$/); // Should end with closing brace
    });

    it('should include nested field selections', () => {
      // Verify nested structure is present
      expect(getOrderByQuery).toContain('edges {');
      expect(getOrderByQuery).toContain('node {');
      
      // Count opening and closing braces to ensure proper nesting
      const openBraces = (getOrderByQuery.match(/{/g) || []).length;
      const closeBraces = (getOrderByQuery.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    });

    it('should include metafield value selections', () => {
      expect(getOrderByQuery).toContain('metafield(');
      expect(getOrderByQuery).toContain('value');
    });

    it('should request sufficient line items', () => {
      // Verify that we're requesting enough line items for typical orders
      expect(getOrderByQuery).toContain('lineItems(first: 100)');
    });

    it('should include price information', () => {
      expect(getOrderByQuery).toContain('originalUnitPriceSet');
      expect(getOrderByQuery).toContain('shopMoney');
    });

    describe('query structure validation', () => {
      it('should be properly formatted GraphQL', () => {
        // Basic validation that it looks like a proper GraphQL query
        expect(getOrderByQuery.trim()).toStartWith('#graphql');
        expect(getOrderByQuery).toContain('query getOrderByQuery');
        expect(getOrderByQuery).toContain('$query: String!');
      });

      it('should have balanced parentheses', () => {
        const openParens = (getOrderByQuery.match(/\(/g) || []).length;
        const closeParens = (getOrderByQuery.match(/\)/g) || []).length;
        expect(openParens).toBe(closeParens);
      });

      it('should not contain syntax errors', () => {
        // Basic checks for common GraphQL syntax errors
        expect(getOrderByQuery).not.toContain(',,');
        expect(getOrderByQuery).not.toContain('{{');
        expect(getOrderByQuery).not.toContain('}}');
      });
    });
  });
});