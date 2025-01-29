import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  TextField,
  Button,
  Icon,
  Form,
  BlockStack,
} from "@shopify/polaris";
import { ProductIcon } from "@shopify/polaris-icons";

export default function TagVerified() {
  const fetcher = useFetcher();
  const [tag, setTag] = useState("");
  const [results, setResults] = useState([]);
  const [variantStatuses, setVariantStatuses] = useState({});

  const handleTagSearch = () => {
    fetcher.submit({ tag }, { method: "post", action: "/actions/tag-search" });
  };

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.results) {
      const newResults = fetcher.data.results.map((edge) => {
        const product = edge.node;
        return {
          id: product.id,
          title: product.title,
          totalInventory: product.totalInventory,
          variants: product.variants.edges.map((variantEdge) => {
            const variant = variantEdge.node;
            return {
              id: variant.id,
              title: variant.title,
              barcode: variant.barcode,
              sku: variant.sku,
              inventoryQuantity: variant.inventoryQuantity,
              status: variantStatuses[variant.id] || "",
            };
          }),
        };
      });

      setResults(newResults);
    }
  }, [fetcher.data]);

  const renderTable = () =>
    results.map((product) => {
      const rows = product.variants.map((variant) => [
        <div
          style={{
            backgroundColor:
              variant.status === "Scanned"
                ? "blue"
                : variant.status === "Newly Scanned"
                  ? "green"
                  : "transparent",
          }}
        >
          {variant.title === "Default Title" ? product.title : variant.title}
        </div>,
        variant.barcode || "N/A",
        variant.sku || "N/A",
        variant.inventoryQuantity,
      ]);

      return (
        <Card key={product.id} title={`Tag: ${tag}`}>
          <DataTable
            columnContentTypes={["text", "text", "text", "numeric"]}
            headings={["Title", "Barcode", "SKU", "Inventory Quantity"]}
            rows={rows}
          />
        </Card>
      );
    });

  return (
    <Page title="Tag Verified">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleTagSearch();
                }}
              >
                <TextField
                  id="tagInput"
                  prefix={<Icon source={ProductIcon} />}
                  label="Tag"
                  value={tag}
                  onChange={setTag}
                  autoComplete="off"
                />
                <Button submit primary>
                  Search Tag
                </Button>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>{renderTable()}</Layout.Section>
      </Layout>
    </Page>
  );
}
