import { useState, useEffect } from "react";
import {
  Page,
  Form,
  TextField,
  Button,
  Layout,
  Card,
  DataTable,
} from "@shopify/polaris";
import { useFetcher } from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  console.log("Received request to tag order");

  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const orderName = formData.get("order");
  const tags = formData.getAll("tags");

  console.log("Form Data Received:", { orderName, tags });

  if (!orderName) {
    console.error("Missing orderName or tags");
    return json({ success: false, error: "Missing order." });
  }

  if (tags.length === 0) {
    console.error("Missing orderName or tags");
    return json({ success: false, error: "Missing tags." });
  }

  try {
    console.log(`Fetching order GID for order ID: ${orderName}`);

    //let orderNumber = Number(orderName);
    let orderFilter = "name:#" + orderName;
    console.log(`Hi`);

    const orderQuery = await admin.graphql(
      `
      query getOrderGID($filter: String!) {
        orders(first: 1, query: $filter) {
          id
          name
          createdAt
          lineItems(first: 100) {
            edges {
              node {
                quantity
              }
            }
          }
          customer {
            firstName
            lastName
          }
        }
      }
    `,
      { variables: { filter: `${orderFilter}` } },
    );
    console.log(orderQuery);
    const orderEdge = orderQuery.data?.orders?.edges[0];
    const orderData = orderEdge?.node;

    if (!orderData) {
      console.error(`Order not found for ID: ${orderName}`);
      return json({ success: false, error: "Order not found." });
    }

    console.log(`Order GID found: ${orderData.id}, proceeding with tagging...`);

    // Add tags to the order
    const tagMutation = await admin.graphql(
      `
      mutation addTagsToOrder($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors {
            message
          }
        }
      }
    `,
      { variables: { id: orderData.id, tags } },
    );

    console.log("Tag mutation response:", tagMutation.data);

    if (tagMutation.data.tagsAdd.userErrors.length > 0) {
      const errorMsg = tagMutation.data.tagsAdd.userErrors[0].message;
      console.error("Tagging failed:", errorMsg);
      return json({ success: false, error: errorMsg });
    }

    console.log(`Successfully tagged order ${order} with tags: ${tags}`);

    return json({
      success: true,
      orderName: order,
      orderDate: orderData.createdAt,
      customerName: `${orderData.customer?.firstName} ${orderData.customer?.lastName}`,
      itemCount: orderData.lineItems.edges.reduce(
        (sum, edge) => sum + edge.node.quantity,
        0,
      ),
      tagsAdded: tags,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ success: false, error: error.message });
  }
};

export default function TagOrders() {
  const fetcher = useFetcher();
  const [tags, setTags] = useState("");
  const [order, setOrder] = useState("");
  const [orderData, setOrderData] = useState([]);
  const isLoading = fetcher.state === "submitting";

  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        console.log("Tagging successful, updating UI");
        setOrderData((prevData) => [fetcher.data, ...prevData]);
        setOrder(""); // Clear order ID after successful submission
      } else if (fetcher.data && !fetcher.data.success) {
        setOrderData((prevData) => [fetcher.data, ...prevData]);
        console.error("Tagging failed:", fetcher.data.error);
        console.log(fetcher.data);
      }
    }
  }, [fetcher.data]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!tags || !order) {
      alert("Please provide both order ID and tags.");
      return;
    }

    const tagArray = tags.split(",").map((tag) => tag.trim());
    console.log("Submitting order for tagging:", { order, tags: tagArray });
    fetcher.submit({ order, tags: tagArray }, { method: "POST" });
  };

  return (
    <Page title="Tag Orders">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Form onSubmit={handleSubmit}>
              <TextField
                label="Tag(s)"
                value={tags}
                onChange={setTags}
                placeholder="Enter comma-separated tags"
                autoComplete="off"
              />
              <TextField
                label="Order"
                value={order}
                onChange={setOrder}
                placeholder="Enter order ID"
                autoComplete="off"
              />
              <Button submit loading={isLoading} primary>
                Add Tags
              </Button>
            </Form>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card title="Tagging History" sectioned>
            <DataTable
              columnContentTypes={[
                "text",
                "text",
                "text",
                "text",
                "text",
                "text",
              ]}
              headings={[
                "Order ID",
                "Order Date",
                "Customer Name",
                "Items",
                "Tags Added",
                "Status",
              ]}
              rows={orderData.map((order) => [
                order.orderName,
                order.orderDate || "N/A",
                order.customerName || "N/A",
                order.itemCount || "N/A",
                order.tagsAdded,
                order.success ? "Success" : "Fail",
              ])}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
