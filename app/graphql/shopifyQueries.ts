// GraphQL queries and mutations for Shopify operations
query adminInfo {
  shop {
    url
  }
}`;

export const GET_PRODUCT_QUERY = `#graphql
query getProduct($id: ID!) {
  product(id: $id) {
    id
    title
    status
    tags
    totalInventory
    product_thumbnail: media(first: 1) {
      nodes {
        preview {
          image {
            url(transform: {maxWidth: 50})
          }
        }
      }
    }
    product_location: metafield(namespace: "custom", key: "product_location") {
      value
    }
    variants(first: 50) {
      edges {
        node {
          id
          title
          barcode
          sku
          inventoryQuantity
          variant_thumbnail: image {
            url(transform: {maxWidth: 50})
          }
          availableForSale
          inventoryItem {
            id
            inventoryHistoryUrl
            inventoryLevels(first: 2) {
              edges {
                node {
                  item { id }
                  location { id name }
                  quantities(names: ["available", "incoming", "committed", "damaged", "on_hand", "quality_control", "reserved", "safety_stock"]) {
                    id
                    name
                    quantity
                  }
                }
              }
            }
          }
          variant_location: metafield(namespace: "custom", key: "variant_location") {
            value
          }
          expiration_json: metafield(namespace: "expiration_dates", key: "allocations") {
            value
          }
        }
      }
    }
  }
}`;

export const ADJUST_INVENTORY_MUTATION = `#graphql
mutation adjustInventory($inventoryLevelName:String!, $levelId: ID!, $locationId: ID!, $delta: Int!) {
  inventoryAdjustQuantities(
    input: {
      reason: "correction",
      name: $inventoryLevelName,
      changes: [{
        inventoryItemId: $levelId,
        locationId: $locationId,
        delta: $delta
      }]
    }
  ) {
    inventoryAdjustmentGroup {
      changes {
        delta
        name
        quantityAfterChange
        location {
          id
          name
        }
        item {
          variant {
            title
            product {
              title
              id
            }
          }
        }
      }
    }
    userErrors {
      message
    }
  }
}`;

export const REMOVE_TAGS_MUTATION = `#graphql
mutation removeTags($id: ID!, $tags: [String!]!) {
  tagsRemove(id: $id, tags: $tags) {
    userErrors {
      message
    }
  }
}`;

export const ADD_TAGS_MUTATION = `#graphql
mutation addTags($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) {
    node {
      id
    }
    userErrors {
      message
    }
  }
}`;

export const SEARCH_PRODUCTS_BY_BARCODE_QUERY = `#graphql
query searchProductsByBarcode($queryString: String) {
  products(first: 75, query: $queryString) {
    edges {
      node {
        id
        title
        featuredMedia {
          id
        }
        status
        tags
        totalInventory
        product_thumbnail: media(first: 1) {
          nodes {
            preview {
              image {
                url(transform: {maxWidth: 50})
              }
            }
          }
        }
        product_location: metafield(namespace: "custom", key: "product_location") {
          value
        }
        variants(first: 50) {
          edges {
            node {
              id
              title
              barcode
              sku
              inventoryQuantity
              variant_thumbnail: image {
                url(transform: {maxWidth: 50})
              }
              availableForSale
              inventoryItem {
                id
                inventoryHistoryUrl
                inventoryLevels(first: 2) {
                  edges {
                    node {
                      item {
                        id
                      }
                      location {
                        id
                        name
                      }
                      quantities(names: ["available", "incoming", "committed", "damaged", "on_hand", "quality_control", "reserved", "safety_stock"]) {
                        id
                        name
                        quantity
                      }
                    }
                  }
                }
              }
              variant_location: metafield(namespace: "custom", key: "variant_location") {
                value
              }
              expiration_json: metafield(namespace: "expiration_dates", key: "allocations") {
                value
              }
            }  
          }
        }
      }
    }
  }
}`;

export const SEARCH_PRODUCTS_BY_TAG_QUERY = `#graphql
query searchProductsByTag($queryString: String) {
  products(first: 75, query: $queryString) {
    edges {
      node {
        id
        title
        featuredMedia {
          id
        }
        status
        tags
        totalInventory
        product_thumbnail: media(first: 1) {
          nodes {
            preview {
              image {
                url(transform: {maxWidth: 50})
              }
            }
          }
        }
        product_location: metafield(namespace: "custom", key: "product_location") {
          value
        }
        variants(first: 50) {
          edges {
            node {
              id
              title
              barcode
              sku
              inventoryQuantity
              variant_thumbnail: image {
                url(transform: {maxWidth: 50})
              }
              availableForSale
              inventoryItem {
                id
                inventoryHistoryUrl
                inventoryLevels(first: 2) {
                  edges {
                    node {
                      item {
                        id
                      }
                      location {
                        id
                        name
                      }
                      quantities(names: ["available", "incoming", "committed", "damaged", "on_hand", "quality_control", "reserved", "safety_stock"]) {
                        id
                        name
                        quantity
                      }
                    }
                  }
                }
              }
              variant_location: metafield(namespace: "custom", key: "variant_location") {
                value
              }
              expiration_json: metafield(namespace: "expiration_dates", key: "allocations") {
                value
              }
            }
          }
        }
      }
    }
  }
}`;
