import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useState } from "react";
import { TextField, Button, Card, Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useActionData, useFetcher } from "@remix-run/react";

// ----- Server: loader -----
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

// ----- Server: action -----
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get("orderExport") === "true") {
    const orderName = formData.get("orderId")?.toString(); // e.g., 1001 or #1001
    const query = `name:${orderName.replace(/^#/, "")}`; // strip leading # if present

    const orderResponse = await admin.graphql(
      `#graphql
      query getOrderByName($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              id
              name
              customer { displayName
                    metafield(namespace: "custom", key: "quickbooks_name") {
                              value
                            } 
              }
              createdAt
              lineItems(first: 100) {
                edges {
                  node {
                    title
                    quantity
                    originalUnitPriceSet {
                      shopMoney { amount }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { variables: { query } },
    );

    const orderEdges = (await orderResponse.json()).data?.orders?.edges;
    const order = orderEdges?.[0]?.node;

    if (!order) {
      return json({ error: "Order not found" }, { status: 404 });
    }

    return json({
      orderExportData: {
        name: order.name,
        customer:
          order.customer?.metafield?.value ||
          order.customer?.displayName ||
          "Guest",
        createdAt: order.createdAt,
        lineItems: order.lineItems.edges.map(({ node }) => ({
          title: node.title,
          quantity: node.quantity,
          rate: parseFloat(node.originalUnitPriceSet.shopMoney.amount),
        })),
      },
    });
  }

  return json({ error: "Invalid submission" }, { status: 400 });
};

// ----- Client: Component -----
export default function OrderExportRoute() {
  const fetcher = useFetcher<typeof action>();
  const data = fetcher.data;
  const [orderId, setOrderId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFetch = () => {
    if (!orderId) return;
    setIsLoading(true);
    fetcher.submit(
      { orderExport: "true", orderId },
      { method: "POST", encType: "application/x-www-form-urlencoded" },
    );
  };

  const downloadCSV = () => {
    if (!data?.orderExportData) return;

    const headers = [
      "*InvoiceNo",
      "*Customer",
      "*InvoiceDate",
      "*DueDate",
      "Terms",
      "Location",
      "Memo",
      "Item(Product/Service)",
      "ItemDescription",
      "ItemQuantity",
      "ItemRate",
      "*ItemAmount",
      "Taxable",
      "TaxRate",
      "Shipping address",
      "Ship via",
      "Shipping date",
      "Tracking no",
      "Shipping Charge",
      "Service Date",
    ];
    const rows = data.orderExportData.lineItems.map((item) => [
      data.orderExportData.name, //*InvoiceNo
      data.orderExportData.customer, // *Customer
      new Date(data.orderExportData.createdAt).toLocaleDateString("en-US"), // *InvoiceDate
      "", // *DueDate
      "", // Terms
      "", // Location
      "", // Memo
      item.title, // Item(Product/Service)
      "", // ItemDescription
      item.quantity, // ItemQuantity
      item.rate, // ItemRate
      item.quantity * item.rate, // *ItemAmount
      "N", // Taxable
      "", // TaxRate
      "", // Shipping address
      "FedEx", // Ship via
      "", // Shipping date
      "", // Tracking no
      "", // Shipping Charge
      "", // Service Date
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice_${data.orderExportData.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page title="QuickBooks Order Export">
      <Card sectioned>
        <TextField
          label="Order Number"
          value={orderId}
          onChange={setOrderId}
          autoComplete="off"
          disabled={isLoading}
        />
        <Button
          onClick={handleFetch}
          loading={fetcher.state !== "idle"}
          primary
        >
          Fetch Order
        </Button>

        {data?.orderExportData && (
          <>
            <p>Customer: {data.orderExportData.customer}</p>
            <ul>
              {data.orderExportData.lineItems.map((item, idx) => (
                <li key={idx}>
                  {item.quantity} x {item.title} @ ${item.rate} = $
                  {item.quantity * item.rate}
                </li>
              ))}
            </ul>
            <Button onClick={downloadCSV}>Download QuickBooks CSV</Button>
          </>
        )}

        {data?.error && <p style={{ color: "red" }}>⚠️ {data.error}</p>}
      </Card>
    </Page>
  );
}
