import { json } from "@remix-run/node";
import { authenticate } from "../../shopify.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const tag = formData.get("tag");

  const results = [];
  let cursor = null;
  let hasNextPage = true;

  try {
    while (hasNextPage) {
      const response = await admin.graphql(
        `#graphql
        query getAllProductsWithTag($tag: String!, $first: Int = 250, $cursor: String) {
          products(first: $first, query: $tag, after: $cursor) {
            edges {
              node {
                id
                title
                tags
                totalInventory
                variants(first: $first) {
                  edges {
                    node {
                      id
                      title
                      barcode
                      sku
                      inventoryQuantity
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }`,
        {
          variables: { tag: `tag:${tag}`, cursor },
        },
      );

      const data = await response.json();
      if (!data?.data?.products) break;

      results.push(...data.data.products.edges);
      cursor = data.data.products.pageInfo.endCursor;
      hasNextPage = data.data.products.pageInfo.hasNextPage;
    }

    return json({ success: true, results });
  } catch (error) {
    return json({ success: false, error: error.message });
  }
};
