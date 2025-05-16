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
  PageClockFilledIcon,
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
  const barcode = formData.get("barcode") as string;
  const tag = formData.get("tag");
  const deleteTag = formData.get("deleteTag");
  const addTag = formData.get("addTag");
  const productId = formData.get("productId");
  const productIds = formData.get("productIds") as string;
  const adjustInventory = formData.get("adjustInventory");
  //const currentQty = parseInt(formData.get("currentQty") as string);

  const result = {
    success: false,
    tag,
    storeUrl: "",
    products: [],
    error: null,
    errors: [],
  };

  try {
    if (productId && !tag && !barcode && !addTag && !deleteTag) {
      result.tag = "__refresh__"; // ✅ Ensures it passes UI filtering

      console.log("999999999");
      // This is a direct refresh for a single product
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

      const productResponse = await admin.graphql(
        `#graphql
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
    }`,
        { variables: { id: productId } },
      );

      const productResult = await productResponse.json();
      const product = productResult.data.product;

      result.success = true;
      result.products = [
        {
          title: product.title,
          tags: product.tags,
          id: product.id,
          status: product.status,
          thumbnail: product.product_thumbnail?.nodes[0]?.preview.image.url,
          totalInventory: product.totalInventory,
          variants: product.variants.edges.map((edge) => {
            const node = edge.node;
            const levels = node.inventoryItem?.inventoryLevels?.edges ?? [];

            const inventoryLevels = levels.map((levelEdge) => ({
              inventoryLevelId: levelEdge.node.item.id,
              locationId: levelEdge.node.location.id,
              locationName: levelEdge.node.location.name,
              quantities: levelEdge.node.quantities,
            }));

            return {
              ...node,
              expiration_json: node.expiration_json ?? null,
              inventoryHistoryUrl: node.inventoryItem?.inventoryHistoryUrl,
              inventoryLevels,
            };
          }),
        },
      ];

      return result;
    }

    if (adjustInventory === "true") {
      const inventoryLevelName = formData.get("inventoryLevelName") as string;
      const levelId = formData.get("levelId") as string;
      const locationId = formData.get("locationId") as string;
      const delta = parseInt(formData.get("delta") as string);

      const adjResponse = await admin.graphql(
        `#graphql
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
          }`,
        {
          variables: {
            inventoryLevelName,
            levelId,
            locationId,
            delta,
          },
        },
      );

      const adjResult = await adjResponse.json();
      if (adjResult.data.inventoryAdjustQuantities.userErrors.length) {
        result.errors.push(
          `Adjustment error: ${adjResult.data.inventoryAdjustQuantities.userErrors
            .map((e) => e.message)
            .join(", ")}`,
        );
      } else {
        const change =
          adjResult.data.inventoryAdjustQuantities.inventoryAdjustmentGroup
            ?.changes?.[0];
        const currentQty = parseInt(formData.get("currentQty") as string);

        result.success = true;
        result.needsRefresh = true;
        result.adjustmentResult = {
          quantityAfterChange:
            change?.quantityAfterChange ?? currentQty + delta,
          productId: change?.item?.variant?.product?.id ?? null,
        };
        return result;
      }
      return result;
    }

    if (deleteTag && productId) {
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
        result.errors.push(deleteResult.data.tagsRemove.userErrors[0].message);
      } else {
        result.success = true;
      }
    } else if (deleteTag && formData.get("bulkDelete") === "true") {
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

      let ids: string[] = [];
      if (productIds != null) ids = productIds.split(",");
      if (ids.length == 0) {
        result.errors.push(`No products available to delete tag: ${deleteTag}`);
        console.log(ids);
      } else {
        for (let i = 0; i < ids.length; i++) {
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
                id: ids[i],
                tags: [deleteTag],
              },
            },
          );

          const deleteResult = await deleteResponse.json();
          if (deleteResult.data.tagsRemove.userErrors.length > 0) {
            result.errors.push(
              deleteResult.data.tagsRemove.userErrors[0].message,
            );
          }
        }
        result.success = true;
        result.products = products;
      }
    } else if (addTag && productId) {
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
        result.errors.push(addResult.data.tagsAdd.userErrors[0].message);
      } else {
        result.success = true;
      }
    } else if (addTag && formData.get("bulkAdd") === "true") {
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
      let ids: string[] = [];
      if (productIds != null) ids = productIds.split(",");
      if (ids.length == 0) {
        result.errors.push(`No products available to add tag: ${addTag}`);
        console.log(ids);
      } else {
        for (let i = 0; i < ids.length; i++) {
          try {
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
                  id: ids[i],
                  tags: [addTag],
                },
              },
            );

            const addResult = await addResponse.json();

            if (addResult.data.tagsAdd.userErrors.length > 0) {
              console.error(
                `Failed to add tag for ${ids[i]}:`,
                addResult.data.tagsAdd.userErrors,
              );
              result.errors.push(addResult.data.tagsAdd.userErrors[0].message);
              continue; // Skip this product and move to the next one
            }

            console.log(`Tag "${addTag}" successfully added to  ${ids[i]}`);
          } catch (error) {
            console.error(`Bulk add error for  ${ids[i]}:`, error);
            result.errors.push(error.message);
          }
        }

        result.success = result.errors.length === 0;
      }
    } else if (tag && barcode) {
      // Fetch the store URL

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
        }`,
        {
          variables: {
            queryString: `barcode:${barcode}`,
          },
        },
      );

      const searchResult = await searchResponse.json();
      const products = searchResult.data.products.edges.map(
        (edge) => edge.node,
      );
      if (!products.length) {
        result.errors.push("No Matching Barcode error");
        result.products.push({
          title: "No Matching Barcode:" + barcode,
          tags: [],
          variants: [
            {
              id: "N/A",
              barcode,
              sku: "No Matching Barcode error",
              inventoryQuantity: 0,
            },
          ],
        });
      } else {
        // Process each product returned from the search
        for (const product of products) {
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
            result.errors.push(tagResult.data.tagsAdd.userErrors[0].message);
          } else {
            result.success = true;
            result.products.push({
              title: product.title,
              tags: updatedTags,
              id: product.id,
              status: product.status,
              thumbnail: product.product_thumbnail?.nodes[0]?.preview.image.url,
              variants: product.variants.edges.map((variantEdge) => {
                const node = variantEdge.node;
                const levels = node.inventoryItem?.inventoryLevels?.edges ?? [];

                const inventoryLevels = levels.map((levelEdge) => ({
                  inventoryLevelId: levelEdge.node.item.id,
                  locationId: levelEdge.node.location.id,
                  locationName: levelEdge.node.location.name,
                  quantities: levelEdge.node.quantities,
                }));
                return {
                  ...node,
                  expiration_json: node.expiration_json ?? null,
                  inventoryHistoryUrl: node.inventoryItem?.inventoryHistoryUrl,
                  inventoryLevels,
                };
              }),
              totalInventory: product.totalInventory,
            });
          }
        }
      }
    } else if (tag && !barcode) {
      // Fetch the store URL
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

      // Search for products by tag
      const tagSearchResponse = await admin.graphql(
        `#graphql
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
        }`,
        {
          variables: {
            queryString: `tag:\"${tag}\"`,
          },
        },
      );
      const tagSearchResult = await tagSearchResponse.json();
      console.log(
        "Tag Search GraphQL Response:",
        JSON.stringify(tagSearchResult, null, 2),
      );

      const products = tagSearchResult.data.products.edges.map((edge) => {
        const product = edge.node;

        return {
          title: product.title,
          tags: product.tags,
          id: product.id,
          status: product.status,
          thumbnail: product.product_thumbnail?.nodes[0]?.preview.image.url,
          variants: product.variants.edges.map((variantEdge) => {
            const node = variantEdge.node;
            const levels = node.inventoryItem?.inventoryLevels?.edges ?? [];

            const inventoryLevels = levels.map((levelEdge) => ({
              inventoryLevelId: levelEdge.node.item.id,
              locationId: levelEdge.node.location.id,
              locationName: levelEdge.node.location.name,
              quantities: levelEdge.node.quantities,
            }));

            return {
              ...node,
              expiration_json: node.expiration_json ?? null,
              inventoryHistoryUrl: node.inventoryItem?.inventoryHistoryUrl,
              inventoryLevels,
            };
          }),
          totalInventory: product.totalInventory,
        };
      });

      if (!products.length) {
        result.errors.push(`No products found with tag: ${tag}`);
      } else {
        result.success = true;
        result.products = products; // Assign correctly formatted products
      }
    }
  } catch (error) {
    result.errors.push(error.message);
  }
  if (result.errors?.length) {
    result.error = result.errors.join("; "); // Concatenate errors for visibility
    console.log(result.error);
  }

  return result;
};

function InventoryAdjustForm({
  inventoryLevelName,
  label,
  quantity,
  levelId,
  locationId,
}) {
  const fetcher = useFetcher();
  const [inputQty, setInputQty] = useState(quantity);
  const delta = inputQty - quantity;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      const newQty = fetcher.data?.adjustmentResult?.quantityAfterChange;
      const productId = fetcher.data?.adjustmentResult?.productId;

      if (typeof newQty === "number") {
        setInputQty(newQty); // ✅ only update this one field
      }

      if (productId) {
        // Optional: refresh the product
        fetcher.submit({ productId }, { method: "POST" });
      }
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <form
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isNaN(delta) && delta !== 0) {
          fetcher.submit(
            {
              adjustInventory: "true",
              inventoryLevelName,
              levelId,
              locationId,
              delta: String(delta),
              currentQty: String(quantity),
            },
            { method: "post", encType: "application/x-www-form-urlencoded" },
          );
        }
      }}
      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
    >
      {label}
      <input
        type="number"
        name={`newQty-${levelId}-${locationId}`}
        value={inputQty}
        onChange={(e) => setInputQty(Number(e.target.value))}
        style={{ width: "60px" }}
        className="inventory-adjust-input"
      />
      <button type="submit" disabled={delta === 0}>
        {delta > 0 ? `+${delta}` : delta}
      </button>
    </form>
  );
}

export default function Index() {
  const fetcher = useFetcher<typeof action>({ key: "adjust" });
  const [barcode, setBarcode] = useState("");
  const [lastBarcode, setLastBarcode] = useState("");
  const [lastBarcodes, setLastBarcodes] = useState([]);
  const [tag, setTag] = useState("");
  const [results, setResults] = useState([]);
  const [lastActionToken, setLastActionToken] = useState(null);
  const isLoading = ["loading", "submitting"].includes(fetcher.state);
  const [tagStatus, setTagStatus] = useState({});

  function replaceCharacters(input: string): string {
    return input.replace(/:/g, " ").replace(/-/g, " dash, ");
  }

  useFocusManagement();

  const handleReset = () => {
    setResults([]);
    setLastBarcodes([]);
    setLastBarcode("");
    setLastActionToken(null);
    //setTag("");
    setBarcode("");

    // Manually clear fetcher data
    fetcher.data = undefined;
  };

  const handleSubmit = (event) => {
    setLastActionToken(null);
    event.preventDefault();

    try {
      if (barcode.trim()) {
        const url = new URL(barcode);
        const params = new URLSearchParams(url.search);
        const tagName = params.get("tag");
        if (tagName) {
          console.log(tagName);
          setTag(tagName);
          console.log(tag);
          const tagSpeak = replaceCharacters(tagName);
          speakText(`Tag Set to ${tagSpeak}`);
          setResults([]);
          setBarcode("");
          fetcher.submit({ tag: tag, barcode: "" }, { method: "POST" });
          return;
        }
      }
    } catch {}
    try {
      if (tag.trim()) {
        const url = new URL(tag);
        const params = new URLSearchParams(url.search);
        const tagName = params.get("tag");

        if (tagName) {
          console.log(tagName);
          console.log(tag);
          const tagSpeak = replaceCharacters(tagName);
          speakText(`Tag Set to ${tagSpeak}`);
          setResults([]);
          setBarcode("");
          fetcher.submit({ tag: tagName, barcode: "" }, { method: "POST" });
          setTag(tagName);
          return;
        }
      }
    } catch {}
    if (!tag) {
      alert("Need At Least the Tag.");
      return;
    }

    fetcher.submit({ barcode, tag }, { method: "POST" });
    setLastBarcode(barcode);
    setLastBarcodes((prev) => [...prev, barcode]);
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

  const handleBulkDeleteTag = (productIds, tagToDelete) => {
    fetcher.submit(
      { productIds: productIds, deleteTag: tagToDelete, bulkDelete: "true" },
      { method: "POST" },
    );

    setResults((prevResults) =>
      prevResults.map((result) => {
        if (
          result.tag === tagToDelete &&
          result.success &&
          result.products.length > 0
        ) {
          return {
            ...result,
            products: result.products.map((product) => ({
              ...product,
              variants: Array.isArray(product.variants) ? product.variants : [], // Ensure it's an array
            })),
          };
        }
        return result;
      }),
    );

    setTagStatus((prev) => ({
      ...prev,
      [tagToDelete]: "Deleted",
    }));
  };

  const handleBulkAddTag = (productIds: string, tagToAdd: string) => {
    fetcher.submit(
      { productIds, addTag: tagToAdd, bulkAdd: "true" },
      { method: "POST", encType: "multipart/form-data" },
    );

    setResults((prevResults) =>
      prevResults.map((result) => {
        if (result.tag === tagToAdd && result.success) {
          return {
            ...result,
            products: result.products.map((product) => ({
              ...product,
              tags: [...new Set([...product.tags, tagToAdd])], // Ensure tag is added
            })),
          };
        }
        return result;
      }),
    );

    setTagStatus((prev) => ({
      ...prev,
      [tagToAdd]: "Readded",
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
      const productId = fetcher.data?.products?.[0]?.id ?? "unknown";
      const tokenBarcode =
        fetcher.data?.products
          ?.flatMap((p) => p.variants.map((v) => v.barcode))
          .find((b) => b === lastBarcode) ?? lastBarcode;

      const actionToken = `${productId}::${tokenBarcode}`;
      if (
        fetcher.data?.products?.[0]?.id &&
        fetcher.data?.adjustmentResult?.productId
      ) {
        console.log(
          "MATCH:",
          fetcher.data.products[0].id,
          fetcher.data.adjustmentResult.productId,
        );
      }
      const timestamp = new Date().toISOString(); // Generate a timestamp
      let scannedVariantInventory = 0;

      if (fetcher.data.products && fetcher.data.products.length > 0) {
        let variantFound = false;

        if (actionToken !== lastActionToken) {
          setLastActionToken(actionToken); // ✅ store to avoid duplicates
          if (fetcher.data.success) {
            if (fetcher.data?.products) {
              fetcher.data.products.forEach((product) => {
                if (!product.variants || !Array.isArray(product.variants)) {
                  product.variants = []; // Prevent errors by ensuring variants is always an array
                }
                if (product?.variants) {
                  product.variants.forEach((variant) => {
                    let variantMessage = ``;
                    let batchQuantityTotal = 0;
                    let hasBatches = false;
                    if (variant.expiration_json?.value) {
                      const expirationData = JSON.parse(
                        variant.expiration_json.value,
                      );
                      variant.expirationDisplay = expirationData.map((exp) => {
                        const batchQuantity = exp.quantity; // Default color
                        const expirationDate = new Date(exp.time);
                        const today = new Date();
                        const daysUntilExpiration = Math.ceil(
                          (expirationDate - today) / (1000 * 60 * 60 * 24),
                        );
                        hasBatches = true;
                        let color = "black"; // Default color
                        let expirationMessage = `Batch Expiring in ${daysUntilExpiration} days`;

                        if (daysUntilExpiration < 0) {
                          color = "red"; // Expired
                          expirationMessage = `A batch expired ${Math.abs(daysUntilExpiration)} days ago`;
                        } else if (daysUntilExpiration == 0) {
                          color = "red"; // Expiring soon
                          expirationMessage = `A batch expired today`;
                        } else if (daysUntilExpiration <= 40) {
                          color = "orange"; // Expiring soon
                          expirationMessage = `A batch expires in ${daysUntilExpiration} days`;
                        }
                        if (batchQuantity == null) {
                          expirationMessage += ` and isn't tracked.`;
                        } else {
                          batchQuantityTotal += batchQuantity;
                          expirationMessage += ` containing ${batchQuantity} items.`;
                        }
                        console.log(
                          `Expiration Date: ${expirationDate.toLocaleDateString()} - Days Until Expiration: ${daysUntilExpiration} - Color: ${color}`,
                          `Expiration Message: ${expirationMessage}`,
                        );
                        return {
                          expirationMessage: expirationMessage,
                          date: expirationDate.toLocaleDateString(),
                          batchQuantity,
                          color,
                        };
                      });
                    } else {
                      variant.expirationDisplay = [
                        { date: "+ Batch", color: "black" },
                      ];
                    }
                    if (
                      batchQuantityTotal != variant.inventoryQuantity &&
                      hasBatches
                    ) {
                      variantMessage += ` Batch Inventory Mismatch`;
                    }
                    variant.variantMessage = variantMessage;
                  });
                }
              });
            }
          }
          if (fetcher.data.products.length > 1 && barcode) {
            speakText(`multiple products`);
          }
          const nonActiveProducts = fetcher.data.products.filter(
            (product) => product.status != "ACTIVE",
          );
          //console.log("All Products:", fetcher.data.products);
          //console.log("Non-Active Products:", nonActiveProducts);
          if (nonActiveProducts.length > 0) {
            speakText(`Non Active ${nonActiveProducts.length}`);
          }
          fetcher.data.products.forEach((product) => {
            const matchedVariants = product.variants.filter(
              (variant) => variant.barcode === lastBarcode,
            );
            if (matchedVariants.length > 1) {
              speakText(`multiple variants`);
            }
            matchedVariants.forEach((matchedVariant) => {
              scannedVariantInventory = matchedVariant.inventoryQuantity || 0;

              if (!fetcher.data.success) {
                //playFailureSound();
                speakText(`not found`);
              } else if (scannedVariantInventory <= 0) {
                //playFailureSound();
                speakText(`no inventory`);
                // if (matchedVariant.expirationDisplay?.map.length > 0) {
                //   speakText(`Expiration Date Batches can be cleared`);
                // }
                matchedVariant.expirationDisplay?.map((exp) => {
                  speakText(exp.expirationMessage);
                });
              } else {
                playSuccessSound();
                speakText(`${scannedVariantInventory}`);
                matchedVariant.expirationDisplay?.map((exp) => {
                  speakText(exp.expirationMessage);
                });
              }

              speakText(matchedVariant.variantMessage);

              variantFound = true;
            });
          });

          if (!variantFound && barcode) {
            playFailureSound();
            speakText(`no variant matched`);
          } else if (fetcher.data.success) {
            playSuccessSound();
          } else {
            playFailureSound();
          }
        }
      }
      try {
        setResults((prevResults) => {
          if (!fetcher.data.success) {
            return [{ ...fetcher.data, timestamp }, ...prevResults];
          }

          const refreshedProductId = fetcher.data.products?.[0]?.id;

          const updatedResults = prevResults.map((result) => {
            const productMatch = result.products?.some(
              (p) => p.id === refreshedProductId,
            );
            if (productMatch) {
              return {
                ...result,
                products: result.products.map((p) =>
                  p.id === refreshedProductId ? fetcher.data.products[0] : p,
                ),
                timestamp,
              };
            }
            return result;
          });

          const isNew = !updatedResults.some((r) =>
            r.products?.some((p) => p.id === refreshedProductId),
          );

          if (isNew) {
            return [{ ...fetcher.data, timestamp }, ...prevResults];
          } else {
            // ✅ Move scanned products to top of their tag record
            return updatedResults.map((result) => {
              if (result.tag === fetcher.data.tag) {
                const newProductIds = new Set(
                  fetcher.data.products.map((p) => p.id),
                );
                const reordered = [
                  ...fetcher.data.products,
                  ...result.products.filter((p) => !newProductIds.has(p.id)),
                ];
                return {
                  ...result,
                  products: reordered,
                  timestamp,
                };
              }
              return result;
            });
          }
        });
      } catch {}
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
  }, [fetcher.state, fetcher.data]);

  const rows = useMemo(() => {
    return results
      .filter((result) => result.tag)
      .map((result, index) => {
        let productIds = result.products.map((product) => product.id).join(",");
        return [
          <div>
            <Text style={{ color: result.success ? "black" : "red" }}>
              {result.success ? "Success" : "Failure"}

              <Button
                icon={SearchListIcon}
                onClick={() => {
                  if (tag) {
                    window.open(
                      `${fetcher.data?.storeUrl}/admin/products/?tag=${encodeURIComponent(result.tag)}`,
                      "_blank",
                    );
                  }
                }}
                disabled={!tag}
              >
                {result.tag}
              </Button>
              {!(tagStatus[result.tag] === "Deleted") && (
                <Button
                  icon={DeleteIcon}
                  onClick={() => handleBulkDeleteTag(productIds, result.tag)}
                  plain
                  loading={isLoading}
                  disabled={isLoading}
                />
              )}
              {tagStatus[result.tag] === "Deleted" && (
                <Button
                  tone="critical"
                  icon={PlusIcon}
                  onClick={() => handleBulkAddTag(productIds, result.tag)}
                  plain
                  loading={isLoading}
                  disabled={isLoading}
                />
              )}
              {<br />}
              {
                <span>
                  <strong>Products:</strong> {result.products.length}
                </span>
              }
            </Text>
          </div>,
          result.products.map((product) => {
            const productId = product.id ? product.id.split("/").pop() : null; // Safely extract ID

            return (
              <div
                key={product.title}
                style={{
                  borderBottom: "2px dotted gray",
                  display: "flex", // Enables flexbox
                  alignItems: "center", // Aligns items vertically
                  gap: "15px", // Adds spacing between image and text
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {product.thumbnail && (
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                    }}
                  >
                    <img
                      src={product.thumbnail}
                      alt={product.title}
                      style={{
                        maxWidth: "50px",
                        height: "auto",
                        borderRadius: "5px",
                        flexShrink: 0,
                        transition: "transform 0.2s ease-in-out",
                      }}
                      onMouseEnter={(e) => {
                        const fullImage = document.createElement("img");
                        fullImage.src = product.thumbnail.replace(/_50x/, ""); // Load full-size image
                        fullImage.style.position = "absolute";
                        fullImage.style.top = "-10px"; // Adjust position
                        fullImage.style.left = "50px"; // Offset to the right
                        fullImage.style.zIndex = "1000"; // Ensure it's above other elements
                        fullImage.style.border = "2px solid #ccc";
                        fullImage.style.background = "#fff";
                        fullImage.style.padding = "5px";
                        fullImage.style.boxShadow =
                          "0px 4px 6px rgba(0,0,0,0.1)";
                        fullImage.style.maxWidth = "500px"; // Adjust as needed
                        fullImage.style.height = "auto";

                        fullImage.setAttribute("id", "hoveredImage");
                        e.currentTarget.parentNode.appendChild(fullImage);
                      }}
                      onMouseLeave={() => {
                        const fullImage =
                          document.getElementById("hoveredImage");
                        if (fullImage) {
                          fullImage.remove(); // Remove the enlarged image on mouse leave
                        }
                      }}
                    />
                  </div>
                )}
                <div style={{ flexGrow: 1 }}>
                  <Button
                    icon={SearchListIcon}
                    onClick={() =>
                      window.open(
                        `${fetcher.data?.storeUrl}/admin/products/${product.id.split("/").pop()}`,
                        "_blank",
                      )
                    }
                  >
                    <strong>{product.title}</strong>
                  </Button>

                  <br />
                  <strong>Total Inventory:</strong>
                  {product.totalInventory}

                  {product.tags.some((tag) => tag.startsWith("Location:")) && (
                    <>
                      <p>
                        <strong>Locations:</strong>
                        {product.tags
                          .filter((tag) => tag.startsWith("Location:")) // Get only location tags
                          .map((tag, index) => {
                            const location = tag.split(":").pop().trim(); // Extract location name
                            return (
                              <p key={index}>
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
                                >
                                  {location} &nbsp;
                                </Button>
                                {!(
                                  tagStatus[product.id] &&
                                  tagStatus[product.id][tag] === "Deleted"
                                ) && (
                                  <Button
                                    icon={DeleteIcon}
                                    onClick={() =>
                                      handleDeleteTag(product.id, tag)
                                    }
                                    plain
                                    hidden={
                                      tagStatus[product.id] &&
                                      tagStatus[product.id][tag] === "Deleted"
                                    }
                                    loading={isLoading}
                                    disabled={isLoading}
                                  />
                                )}
                                {tagStatus[product.id] &&
                                  tagStatus[product.id][tag] === "Deleted" && (
                                    <Button
                                      tone="critical"
                                      icon={PlusIcon}
                                      onClick={() =>
                                        handleAddTag(product.id, tag)
                                      }
                                      plain
                                      hidden={
                                        !(
                                          tagStatus[product.id] &&
                                          tagStatus[product.id][tag] ===
                                            "Deleted"
                                        )
                                      }
                                      loading={isLoading}
                                      disabled={isLoading}
                                    />
                                  )}
                              </p>
                            );
                          })}
                      </p>
                    </>
                  )}
                </div>
                <table style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          borderBottom: "2px solid gray",
                          textAlign: "left",
                        }}
                      >
                        Title
                      </th>
                      <th
                        style={{
                          borderBottom: "2px solid gray",
                          textAlign: "left",
                        }}
                      >
                        Qty
                      </th>
                      <th
                        style={{
                          borderBottom: "2px solid gray",
                          textAlign: "left",
                        }}
                      >
                        Barcode / SKU
                      </th>

                      <th
                        style={{
                          borderBottom: "2px solid gray",
                          textAlign: "left",
                        }}
                      >
                        Exp
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(product.variants ?? []).map((variant) => {
                      const variantId = variant.id
                        ? variant.id.split("/").pop()
                        : null; // Safely extract ID
                      return (
                        <tr
                          key={variant.barcode}
                          style={{
                            borderTop: "1px dotted gray",
                            fontWeight:
                              lastBarcode == variant.barcode ? "bold" : "",
                            backgroundColor: lastBarcodes.includes(
                              variant.barcode,
                            )
                              ? "#ffff99"
                              : "inherit", // Optional background highlight
                          }}
                        >
                          <td width="350">
                            <Button
                              icon={SearchIcon}
                              onClick={() =>
                                window.open(
                                  `${fetcher.data?.storeUrl}/admin/products/${productId}/variants/${variantId}`,
                                  "_blank",
                                )
                              }
                            >
                              {variant.title == "Default Title"
                                ? product.title
                                : variant.title}
                            </Button>
                          </td>
                          <td>
                            {(
                              variant.inventoryItem?.inventoryLevels?.edges ??
                              []
                            ).map((edge, i, allEdges) => {
                              const locationName = edge.node.location.name;
                              const quantities = edge.node.quantities ?? [];
                              const nonZeroQuantities = quantities.filter(
                                (q) =>
                                  q.name === "available" || q.quantity !== 0,
                              );

                              if (nonZeroQuantities.length === 0) return null;

                              return (
                                <div key={i} style={{ marginBottom: "0.75em" }}>
                                  {allEdges.length > 1 && (
                                    <strong>{locationName}</strong>
                                  )}
                                  <ul style={{ paddingLeft: "1em", margin: 0 }}>
                                    {nonZeroQuantities.map((q, j) => {
                                      const label = q.name
                                        .split("_")
                                        .map(
                                          (part) =>
                                            part.charAt(0).toUpperCase() +
                                            part.slice(1),
                                        )
                                        .join(" ");

                                      return (
                                        <li key={j}>
                                          {q.name === "available" ? (
                                            <InventoryAdjustForm
                                              key={`${edge.node.item.id}-${edge.node.location.id}-${q.name}`}
                                              inventoryLevelName={q.name}
                                              label={label}
                                              quantity={q.quantity}
                                              levelId={edge.node.item.id}
                                              locationId={edge.node.location.id}
                                            />
                                          ) : (
                                            `${label}: ${q.quantity}`
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              );
                            })}{" "}
                            {variant.inventoryHistoryUrl && (
                              <Button
                                icon={PageClockFilledIcon}
                                onClick={() =>
                                  window.open(
                                    variant.inventoryHistoryUrl,
                                    "_blank",
                                  )
                                }
                                plain
                              />
                            )}{" "}
                          </td>

                          <td>
                            {variant.barcode || "N/A"}
                            <br />
                            {variant.sku}
                          </td>
                          <td>
                            {(variant.expirationDisplay?.length > 0
                              ? variant.expirationDisplay
                              : [{ date: "View Batch", color: "black" }]
                            ).map((exp, index) => {
                              const expirationLink = `https://apps.screenstaring.com/ed/shopify/variant?id=${variantId}`;
                              return (
                                <span key={index} style={{ color: exp.color }}>
                                  <a
                                    href={expirationLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      textDecoration: "none",
                                      color: exp.color,
                                    }}
                                  >
                                    {exp.date}{" "}
                                    {exp.batchQuantity != null ? (
                                      <span>({exp.batchQuantity})</span>
                                    ) : null}
                                  </a>
                                </span>
                              );
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {result.success && (
                      <details>
                        <summary>All Tags</summary>
                        <DataTable
                          hideScrollIndicator={true}
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
                              {!(
                                tagStatus[product.id] &&
                                tagStatus[product.id][tag] === "Deleted"
                              ) && (
                                <Button
                                  icon={DeleteIcon}
                                  onClick={() =>
                                    handleDeleteTag(product.id, tag)
                                  }
                                  plain
                                  hidden={
                                    tagStatus[product.id] &&
                                    tagStatus[product.id][tag] === "Deleted"
                                  }
                                  loading={isLoading}
                                  disabled={isLoading}
                                />
                              )}
                              {tagStatus[product.id] &&
                                tagStatus[product.id][tag] === "Deleted" && (
                                  <Button
                                    tone="critical"
                                    icon={PlusIcon}
                                    onClick={() =>
                                      handleAddTag(product.id, tag)
                                    }
                                    plain
                                    hidden={
                                      !(
                                        tagStatus[product.id] &&
                                        tagStatus[product.id][tag] === "Deleted"
                                      )
                                    }
                                    loading={isLoading}
                                    disabled={isLoading}
                                  />
                                )}
                            </div>,
                          ])}
                        />
                      </details>
                    )}
                  </tfoot>
                </table>
              </div>
            );
          }),
        ];
      });
  }, [results]);

  return (
    <Page
      fullWidth
      style={{
        position: "absolute",
        left: "0",
        right: "0",
      }}
    >
      <TitleBar title="Ceely Quick Tag" />
      {/* <div>{fetcher.data?.storeUrl}</div> */}
      <div style={{ maxWidth: "200px" }}>
        <Form
          onSubmit={(event) => {
            handleSubmit(event);
            document.getElementById("barcodeField")?.focus;
          }}
        >
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
          {/*  <Button
          onClick={() => {
            if (!tag.trim()) {
              console.error("No tag provided!"); // Debugging
              return;
            }

            console.log("Attempting to submit tag search request for:", tag);

            try {
              fetcher.submit(
                { tag },
                {
                  method: "POST",
                  encType: "application/x-www-form-urlencoded",
                },
              );
              console.log("Fetcher submit() executed successfully.");
            } catch (error) {
              console.error("Error submitting tag search request:", error);
            }
          }}
          disabled={!tag}
          primary
        >
          Search Products by Tag
        </Button> */}
          <TextField
            id="barcodeField"
            prefix={<Icon source={BarcodeIcon} />}
            type="text"
            label="Barcode"
            value={barcode}
            onChange={setBarcode}
            autoComplete="off"
          />
          <Button submit loading={isLoading} primary>
            {barcode ? "Tag Product" : "Search"}
          </Button>
          <Button onClick={handleReset} disabled={results.length === 0}>
            Reset
          </Button>
        </Form>
      </div>
      <Text>Total Request Count: {results.length}</Text>
      <DataTable
        hideScrollIndicator={true}
        columnContentTypes={["text", "text", "text"]}
        headings={[""]}
        rows={rows}
      />
    </Page>
  );
}
