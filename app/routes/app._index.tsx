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
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const barcode = formData.get("barcode");
  const tag = formData.get("tag");

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
          }
        }
      }
    }`,
    {
      variables: {
        queryString: `barcode:${barcode}`,
      },
    }
  );

  const searchResult = await searchResponse.json();
  const product = searchResult.data.products.edges[0]?.node;

  if (!product) {
    return { error: "Product not found" };
  }

  // Add the user-defined tag to the product
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
        tags: [tag],
      },
    }
  );

  const tagResult = await tagResponse.json();
  if (tagResult.data.tagsAdd.userErrors.length > 0) {
    return { error: tagResult.data.tagsAdd.userErrors[0].message };
  }

  return { product, success: true };
};

function useLocationTags() {
  const [tags, setTags] = useState([String]);
  const shopify = useAppBridge();

  useEffect(() => {
    const fetchTags = async () => {
      let accumulatedTags = [];
      let hasNextPage = true;
      let endCursor = null;

      while (hasNextPage) {
        const response = await shopify.admin.graphql(
          `#graphql
          query fetchTags($first: Int!, $after: String) {
            productTags(first: $first, after: $after) {
              edges {
                cursor
                node
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }`,
          {
            variables: {
              first: 250,
              after: endCursor,
            },
          }
        );

        const result = await response.json();
        const fetchedTags = result.data.productTags.edges.map((edge) => edge.node);
        const filteredTags = fetchedTags.filter((tag) => tag.startsWith("Location:"));

        accumulatedTags.push(...filteredTags);
        hasNextPage = result.data.productTags.pageInfo.hasNextPage;
        endCursor = result.data.productTags.pageInfo.endCursor;
      }

      setTags(accumulatedTags);
    };

    fetchTags();
  }, [shopify]);

  return tags;
}

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const [barcode, setBarcode] = useState("");
  const [lastBarcode, setLastBarcode] = useState("")
  const [tag, setTag] = useState("");
  const [lastTag, setLastTag] = useState("")
  const tagOptions = useLocationTags();
  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  const handleSubmit = () => {
    setLastBarcode(barcode);
    setLastTag(tag);
    fetcher.submit({ barcode, tag }, { method: "POST" });
    setBarcode("");
  };
const suggestions = tagOptions;

  const [value, setValue] = useState('');
  const [suggestion, setSuggestion] = useState<string | undefined>();

  const handleChange = useCallback(
    (value: string) => {
      const suggestion =
        value &&
        suggestions.find((suggestion) =>
          suggestion.toLowerCase().startsWith(value.toLowerCase()),
        );

      setValue(value);
      setSuggestion(suggestion);
    },
    [suggestions],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Tab') {
        setValue(suggestion || value);
        setSuggestion('');
      } else if (event.key === 'Backspace') {
        setValue(value);
        setSuggestion('');
      }
    },
    [value, suggestion],
  );

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
                onChange={setTag}/>
              <TextField
                type="text"
                label="Barcode Search"
                value={barcode}
                onChange={setBarcode}
                autoComplete="on"/>
              <Button submit loading={isLoading}>
                Search and Tag Product
              </Button>
              {fetcher.data?.error && (
                <Text color="critical">Error: {fetcher.data.error}</Text>
              )}
              {fetcher.data?.success && (
                <Text color="success">Product  {lastBarcode} tagged with {lastTag} successfully!</Text>
              )}
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
