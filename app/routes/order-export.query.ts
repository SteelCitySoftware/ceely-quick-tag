// GraphQL query for fetching a Shopify order by query string (order id or name)
export const getOrderByQuery = `#graphql
  query getOrderByQuery($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          id
          name
          customer {
            displayName
            quickbooksName: metafield(namespace: "custom", key: "quickbooks_name") {
              value
            }
          }
          createdAt
          lineItems(first: 100) {
            edges {
              node {
                title
                quantity
                originalUnitPriceSet {
                  shopMoney { amount }
                }
                variant {
                  sku
                  product {
                    productType
                  }
                }
              }
            }
          }
          customerPONumber: metafield(namespace: "custom", key: "customer_po_number") {
            value
          }
        }
      }
    }
  }
`;