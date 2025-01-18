import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
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
  Tooltip,
} from "@shopify/polaris";
import { PlusIcon, DeleteIcon } from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import successSound from "./sounds/success.mp3"; // Add your failure sound file in the correct directory
import failureSound from "./sounds/failure.mp3"; // Add your failure sound file in the correct directory

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const barcode = formData.get("barcode");
  const tag = formData.get("tag");
  const deleteTag = formData.get("deleteTag");
  const addTag = formData.get("addTag");
  const productId = formData.get("productId");

  const result = {
    success: false,
    tag,
    products: [],
    error: null,
  };

  try {
    if (deleteTag && productId) {
      // Remove the tag from the product
      const deleteResponse = await admin.graphql(
        `#graphql
        mutation removeTags($id: ID!, $tags: [String!]!) {
          tagsRemove(id: $id, tags: $tags) {
            userErrors {
              message
            }
          }
        }`,
        {
          variables: {
            id: productId,
            tags: [deleteTag],
          },
        },
      );

      const deleteResult = await deleteResponse.json();
      if (deleteResult.data.tagsRemove.userErrors.length > 0) {
        result.error = deleteResult.data.tagsRemove.userErrors[0].message;
      } else {
        result.success = true;
      }
    } else if (addTag && productId) {
      // Add the tag back to the product
      const addResponse = await admin.graphql(
        `#graphql
        mutation addTags($id: ID!, $tags: [String!]!) {
          tagsAdd(id: $id, tags: $tags) {
            node {
              id
            }
            userErrors {
              message
            }
          }
        }`,
        {
          variables: {
            id: productId,
            tags: [addTag],
          },
        },
      );

      const addResult = await addResponse.json();
      if (addResult.data.tagsAdd.userErrors.length > 0) {
        result.error = addResult.data.tagsAdd.userErrors[0].message;
      } else {
        result.success = true;
      }
    } else {
      // Search for the product by barcode
      const searchResponse = await admin.graphql(
        `#graphql
        query searchProductsByBarcode($queryString: String) {
          products(first: 1, query: $queryString) {
            edges {
              node {
                id
                title
                tags
                totalInventory
                variants(first: 5) {
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
        result.products.push({
          title: "No Matching Barcode:" + barcode,
          tags: [],
          variants: [
            { barcode, sku: "No Matching Barcode error", inventoryQuantity: 0 },
          ],
        });
      } else {
        // Add the user-defined tag to the product
        const updatedTags = [...new Set([...product.tags, tag])];
        const tagResponse = await admin.graphql(
          `#graphql
          mutation addTags($id: ID!, $tags: [String!]!) {
            tagsAdd(id: $id, tags: $tags) {
              node {
                id
              }
              userErrors {
                message
              }
            }
          }`,
          {
            variables: {
              id: product.id,
              tags: updatedTags,
            },
          },
        );

        const tagResult = await tagResponse.json();
        if (tagResult.data.tagsAdd.userErrors.length > 0) {
          result.error = tagResult.data.tagsAdd.userErrors[0].message;
        } else {
          result.success = true;
          result.products.push({
            title: product.title,
            tags: updatedTags,
            id: product.id,
            variants: product.variants.edges.map(
              (variantEdge) => variantEdge.node,
            ),
            totalInventory: product.totalInventory,
          });
        }
      }
    }
  } catch (error) {
    result.error = error.message;
  }

  return result;
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const [barcode, setBarcode] = useState("");
  const [tag, setTag] = useState("");
  const [results, setResults] = useState([]);
  const isLoading = ["loading", "submitting"].includes(fetcher.state);
  const [tagStatus, setTagStatus] = useState({});
  const [uniqueProductCount, setUniqueProductCount] = useState(0);
  const handleReset = () => {
    setResults([]);
    setUniqueProductCount(0);
  };

  const handleSubmit = () => {
    fetcher.submit({ barcode, tag }, { method: "POST" });
    setBarcode("");
  };

  const handleDeleteTag = (productId, tagToDelete) => {
    fetcher.submit({ productId, deleteTag: tagToDelete }, { method: "POST" });
    setTagStatus((prev) => ({
      ...prev,
      [tagToDelete]: "Deleted",
    }));
  };

  const handleAddTag = (productId, tagToAdd) => {
    fetcher.submit({ productId, addTag: tagToAdd }, { method: "POST" });
    setTagStatus((prev) => ({
      ...prev,
      [tagToAdd]: "Readded",
    }));
  };

  const playFailureSound = () => {
    const audio = new Audio(failureSound);
    audio.play();
  };
  const playSuccessSound = () => {
    const audio = new Audio(successSound);
    audio.play();
  };

  useEffect(() => {
    if (fetcher.data) {
      setResults((prevResults) => {
        // If success is false, always add a new entry
        if (!fetcher.data.success) {
          return [fetcher.data, ...prevResults];
        }

        // For successful results, update the existing entry or add a new one
        const existingIndex = prevResults.findIndex(
          (result) =>
            result.products[0]?.id === fetcher.data.products[0]?.id &&
            result.tag === fetcher.data.tag,
        );

        if (existingIndex !== -1) {
          const updatedResults = [...prevResults];
          updatedResults[existingIndex] = fetcher.data;
          return updatedResults;
        }

        return [fetcher.data, ...prevResults];
      });

      // Play the appropriate sound
      if (!fetcher.data.success) {
        playFailureSound();
      } else {
        playSuccessSound();
      }

      // Update tag status
      if (fetcher.data.success && fetcher.data.tag) {
        setTagStatus((prev) => ({
          ...prev,
          [fetcher.data.tag]: "Success",
        }));
      } else if (!fetcher.data.success && fetcher.data.tag) {
        setTagStatus((prev) => ({
          ...prev,
          [fetcher.data.tag]: "Failure",
        }));
      }
    }
  }, [fetcher.data]);

  const rows = useMemo(() => {
    return results
      .filter((result) => result.tag)
      .map((result, index) => {
        return [
          <Text style={{ color: result.success ? "black" : "red" }}>
            {result.success ? "Success" : "Failure"}
          </Text>,
          result.tag || "N/A",
          result.products.map((product) => (
            <div key={product.title}>
              <div>
                <strong>{product.title}</strong> Total Inventory:{" "}
                <strong>{product.totalInventory}</strong>
              </div>
              <ul>
                {product.variants.map((variant) => (
                  <li key={variant.sku}>
                    <strong>Title:</strong>
                    {variant.title == "Default Title"
                      ? product.title
                      : variant.title}{" "}
                    <strong>Barcode:</strong> {variant.barcode || "N/A"},{" "}
                    <strong>SKU:</strong> {variant.sku},{" "}
                    <strong>Quantity:</strong> {variant.inventoryQuantity}
                  </li>
                ))}
              </ul>
              {result.success && (
                <details>
                  <summary>View Tags</summary>
                  <DataTable
                    columnContentTypes={["text", "text"]}
                    headings={["Tag", "Status", "Action"]}
                    rows={product.tags.map((tag) => [
                      tag,
                      <i>{tagStatus[tag] || "Existing"}</i>,
                      <div>
                        <Button
                          icon={DeleteIcon}
                          onClick={() => handleDeleteTag(product.id, tag)}
                          plain
                          disabled={tagStatus[tag] === "Deleted"}
                        >
                          Delete
                        </Button>
                        <Button
                          tone="critical"
                          icon={PlusIcon}
                          onClick={() => handleAddTag(product.id, tag)}
                          plain
                          disabled={tagStatus[tag] != "Deleted"}
                        >
                          Add Back
                        </Button>
                      </div>,
                    ])}
                  />
                </details>
              )}
            </div>
          )),
        ];
      });
  }, [results]);

  return (
    <Page>
      <TitleBar title="Ceely Quick Tag" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Form onSubmit={handleSubmit}>
                <TextField
                  label="Tag"
                  value={tag}
                  onChange={setTag}
                  autoComplete="off"
                />
                <TextField
                  type="text"
                  label="Barcode Search"
                  value={barcode}
                  onChange={setBarcode}
                  autoComplete="off"
                />
                <Button submit loading={isLoading} primary>
                  Search and Tag Product
                </Button>
                <Button onClick={handleReset} disabled={results.length === 0}>
                  Reset
                </Button>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card title="Summary">
            <Text>Total Unique Products Added: {uniqueProductCount}</Text>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card title="Results">
            <DataTable
              columnContentTypes={["text", "text", "text"]}
              headings={["Status", "Tag Used", "Products"]}
              rows={rows}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
