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
import {
  ProductIcon,
  PlusIcon,
  DeleteIcon,
  SearchListIcon,
  SearchIcon,
  BarcodeIcon,
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import successSound from "./sounds/success.mp3"; // Add your failure sound file in the correct directory
import failureSound from "./sounds/failure.mp3"; // Add your failure sound file in the correct directory

//custom imports
import useFocusManagement from "../hooks/useFocusManagement";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    storeUrl: "",
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
      // Fetch the store URL

      //possibly verify if the request has been complete already so it doesn't pull it multiple times for no reason.
      const storeResponse = await admin.graphql(
        `#graphql
            query adminInfo {
              shop {
                url
              }
            }`,
      );

      const storeData = await storeResponse.json();
      result.storeUrl = storeData.data.shop.url;

      // Search for the product by barcode
      const searchResponse = await admin.graphql(
        `#graphql
        query searchProductsByBarcode($queryString: String) {
          products(first: 250, query: $queryString) {
            edges {
              node {
                id
                status
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
  const [lastBarcode, setLastBarcode] = useState("");
  const [tag, setTag] = useState("");
  const [results, setResults] = useState([]);
  const isLoading = ["loading", "submitting"].includes(fetcher.state);
  const [tagStatus, setTagStatus] = useState({});

  function replaceCharacters(input: string): string {
    return input.replace(/:/g, " ").replace(/-/g, " dash, ");
  }

  useFocusManagement();

  const handleReset = () => {
    setResults([]);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (barcode.trim()) {
      try {
        const url = new URL(barcode);
        const params = new URLSearchParams(url.search);
        const tagName = params.get("tag");

        if (tagName) {
          setTag(tagName);
          const tagSpeak = replaceCharacters(tagName);
          speakText(`Tag Set to ${tagSpeak}`);
          setResults([]);
          setBarcode(""); // Clear the barcode field
          document.getElementById("barcodeField").focus;
          return;
        }
      } catch (error) {
        // Not a valid URL, proceed as usual
      }
    } else if (!barcode.trim() || !tag.trim()) {
      alert("Both Tag and Barcode fields must be filled.");
      return;
    }

    // Detect if the barcode is a URL

    fetcher.submit({ barcode, tag }, { method: "POST" });
    setLastBarcode(barcode);
    setBarcode("");
  };

  const handleDeleteTag = (productId, tagToDelete) => {
    fetcher.submit({ productId, deleteTag: tagToDelete }, { method: "POST" });
    setTagStatus((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [tagToDelete]: "Deleted",
      },
    }));
  };

  const handleAddTag = (productId, tagToAdd) => {
    fetcher.submit({ productId, addTag: tagToAdd }, { method: "POST" });
    setTagStatus((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [tagToAdd]: "Readded",
      },
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

  const speakText = (text) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    } else {
      console.error("Speech synthesis is not supported in this browser.");
    }
  };

  /*   useEffect(() => {
    const handleFocusChange = (event) => {
      sleep(2000);
      const focusedElement = document.activeElement;
      const tagField = document.getElementById("tag");
      const barcodeField = document.getElementById("barcodeField");
      if (focusedElement !== tagField && focusedElement !== barcodeField) {
        barcodeField?.focus();
      }
    };

    document.addEventListener("focusin", handleFocusChange);

    return () => {
      document.removeEventListener("focusin", handleFocusChange);
    };
  }, []); */

  useEffect(() => {
    if (fetcher.data) {
      const timestamp = new Date().toISOString(); // Generate a timestamp
      let scannedVariantInventory = 0;

      if (fetcher.data.products && fetcher.data.products.length > 0) {
        let variantFound = false;

        fetcher.data.products.forEach((product) => {
          const matchedVariant = product.variants.find(
            (variant) => variant.barcode === lastBarcode,
          );

          if (matchedVariant) {
            scannedVariantInventory = matchedVariant.inventoryQuantity || 0;

            if (!fetcher.data.success) {
              playFailureSound();
              speakText(`not found`);
            } else if (scannedVariantInventory <= 0) {
              playFailureSound();
              speakText(`no inventory`);
            } else {
              playSuccessSound();
              speakText(`${scannedVariantInventory}`);
            }

            variantFound = true;
          }
        });

        if (!variantFound) {
          playFailureSound();
          speakText(`not found`);
        }
      } else {
        if (fetcher.data.success) {
          playSuccessSound();
        } else {
          playFailureSound();
        }
      }

      setResults((prevResults) => {
        if (!fetcher.data.success) {
          return [{ ...fetcher.data, timestamp }, ...prevResults];
        }

        const existingIndex = prevResults.findIndex(
          (result) =>
            result.products[0]?.id === fetcher.data.products[0]?.id &&
            result.tag === fetcher.data.tag,
        );

        if (existingIndex !== -1) {
          const updatedResults = [...prevResults];
          updatedResults[existingIndex] = { ...fetcher.data, timestamp };
          return updatedResults;
        }

        return [{ ...fetcher.data, timestamp }, ...prevResults];
      });

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
          new Date(result.timestamp).toLocaleString(), // Display timestamp
          result.products.map((product) => (
            <div key={product.title}>
              <div>
                <Button
                  icon={SearchIcon}
                  onClick={() =>
                    window.open(
                      `${fetcher.data?.storeUrl}/admin/products/${product.id.split("/").pop()}`,
                      "_blank",
                    )
                  }
                ></Button>
                <strong>{product.title}</strong> Total Inventory:
                <strong>{product.totalInventory}</strong>
              </div>
              <ul>
                {product.variants.map((variant) => (
                  <li key={variant.sku}>
                    <strong>Title:</strong>
                    {variant.title == "Default Title"
                      ? product.title
                      : variant.title}{" "}
                    <br />
                    <strong>Barcode:</strong> {variant.barcode || "N/A"},{" "}
                    <strong>SKU:</strong> {variant.sku}, <br />
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
                      <i>
                        {(tagStatus[product.id] &&
                          tagStatus[product.id][tag]) ||
                          "Existing"}
                      </i>,
                      <div>
                        <Button
                          icon={SearchListIcon}
                          onClick={() => {
                            if (tag) {
                              window.open(
                                `${fetcher.data?.storeUrl}/admin/products/?tag=${encodeURIComponent(tag)}`,
                                "_blank",
                              );
                            }
                          }}
                          disabled={!tag}
                        ></Button>
                        <Button
                          icon={DeleteIcon}
                          onClick={() => handleDeleteTag(product.id, tag)}
                          plain
                          disabled={
                            tagStatus[product.id] &&
                            tagStatus[product.id][tag] === "Deleted"
                          }
                        >
                          Delete
                        </Button>
                        <Button
                          tone="critical"
                          icon={PlusIcon}
                          onClick={() => handleAddTag(product.id, tag)}
                          plain
                          disabled={
                            !(
                              tagStatus[product.id] &&
                              tagStatus[product.id][tag] === "Deleted"
                            )
                          }
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
      <div>{fetcher.data?.storeUrl}</div>

      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Form onSubmit={handleSubmit}>
                <TextField
                  id="tagField"
                  prefix={<Icon source={ProductIcon} />}
                  label="Tag"
                  value={tag}
                  onChange={setTag}
                  autoComplete="off"
                />{" "}
                {/*                 <Button
                  icon={SearchListIcon}
                  onClick={() => {
                    if (tag) {
                      window.open(
                        `${fetcher.data?.storeUrl}}/admin/products?tag=${encodeURIComponent(tag)}`,
                        "_blank",
                      );
                    }
                  }}
                  disabled={!tag}
                ></Button> */}{" "}
                <TextField
                  id="barcodeField"
                  prefix={<Icon source={BarcodeIcon} />}
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
            <Text>Total Unique Products Scanned: {results.length}</Text>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card title="Results">
            <DataTable
              columnContentTypes={["text", "text", "text"]}
              headings={["Status", "Tag Used", "Scanned On", "Products"]}
              rows={rows}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
