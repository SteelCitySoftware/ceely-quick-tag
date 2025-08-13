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
                currentQuantity
                originalUnitPriceSet {
                  shopMoney { amount }
                }
                variant {
                  title
                  sku
                  product {
                    productType
                  }
                }
              }
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
                        lineItem {
                          title
                          quantity
                          currentQuantity
                          originalUnitPriceSet {
                            shopMoney {
                              amount
                            }
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