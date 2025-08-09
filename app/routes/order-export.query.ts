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
            fulfillments {
              id
              status
              name
              trackingInfo {
                company
                number
                url
              }
              fulfillmentOrders(first: 10) {
                edges {
                  node {
                    lineItems(first: 250) {
                      edges {
                        node {
                          id
                          productTitle
                          variantTitle
                          totalQuantity
                          variant {
                            compareAtPrice
                            price
                            sku
                            product {
                              productType
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
`;