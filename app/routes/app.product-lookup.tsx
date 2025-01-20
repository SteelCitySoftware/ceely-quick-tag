import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, Link } from "@remix-run/react";
import {
  Page,
  Form,
  Layout,
  Text,
  Card,
  Button,
  TextField,
  BlockStack,
  DataTable,
  Icon,
} from "@shopify/polaris";
import { SearchListIcon, SearchIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export let storeUrl = "";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const barcode = formData.get("barcode");
  const result = {
    success: false,
    products: [],
    storeUrl: "",
    error: null,
  };

  try {
    // Fetch the store URL
    if (storeUrl == "") {
      const storeResponse = await admin.graphql(
        `#graphql
      query adminInfo {
        shop {
          url
        }
      }`,
      );

      const storeData = await storeResponse.json();
      storeUrl = storeData.data.shop.url;
      result.storeUrl = storeUrl;
    }

    // Search for the product by barcode
    if (barcode) {
      const searchResponse = await admin.graphql(
        `#graphql
        query searchProductsByBarcode($queryString: String) {
          products(first: 250, query: $queryString) {
            edges {
              node {
                id
                title
                tags
                totalInventory
                variants(first: 250) {
                  edges {
                    node {
                      title
                      barcode
                      sku
                      inventoryQuantity
                    }
                  }
                }
              }
            }
          }
        }`,
        {
          variables: {
            queryString: `barcode:${barcode}`,
          },
        },
      );

      const searchResult = await searchResponse.json();
      const product = searchResult.data.products.edges[0]?.node;

      if (!product) {
        result.error = "No Matching Barcode error";
      } else {
        result.success = true;
        result.products.push(product);
      }
    }
  } catch (error) {
    result.error = error.message;
  }

  return result;
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();

  const rows = useMemo(() => {
    if (!fetcher.data || !fetcher.data.products) return [];

    return fetcher.data.products.map((product) => {
      const productId = product.id.split("/").pop(); // Extract the product ID
      const productLink = `${fetcher.data.storeUrl}/admin/products/${productId}`;

      return [
        <Text key={`title-${productId}`}>{product.title}</Text>,
        <Button
          key={`button-${productId}`}
          icon={SearchIcon}
          onClick={() => window.open(productLink, "_blank")}
          plain
        >
          View Product
        </Button>,
      ];
    });
  }, [fetcher.data]);

  return (
    <Page>
      <TitleBar title="Product Lookup" />
      <Layout>
        <Layout.Section>
          <Card>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                fetcher.submit({ barcode: "" }, { method: "POST" });
              }}
            >
              <TextField
                label="Barcode"
                onChange={(value) =>
                  fetcher.submit({ barcode: value }, { method: "POST" })
                }
              />
              <Button submit primary>
                Search
              </Button>
            </Form>
          </Card>
          <Card title="Store URL">
            <Text>
              {fetcher.data?.storeUrl
                ? `Store URL: ${fetcher.data.storeUrl}`
                : "Loading store URL..."}
            </Text>
            {fetcher.data?.error && (
              <Text color="critical">Error: {fetcher.data.error}</Text>
            )}
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card title="Search Results">
            <DataTable
              columnContentTypes={["text", "text"]}
              headings={["Product", "Action"]}
              rows={rows}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
