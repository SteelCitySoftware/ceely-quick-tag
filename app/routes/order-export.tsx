import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useState, useEffect } from "react";
import { TextField, Button, Card, Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useActionData, useFetcher, useLoaderData } from "@remix-run/react";

// ----- Server: loader -----
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const orderNumber = url.searchParams.get("order_number");

  return json({ orderNumber });
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
              customer {
                displayName
                quickbooksName: metafield(namespace: "custom", key: "quickbooks_name") {
                  value
                 }
              }
              createdAt
              fulfillmentStatus
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
                customerPONumber: metafield(namespace: "custom", key: "customer_po_number") {
                                value
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
          order.customer?.quickbooksName?.value ||
          order.customer?.displayName ||
          "Guest",
        createdAt: order.createdAt,
        fulfillmentStatus: order.fulfillmentStatus,
        lineItems: order.lineItems.edges.map(({ node }) => ({
          title: node.title,
          quantity: node.quantity,
          rate: parseFloat(node.originalUnitPriceSet.shopMoney.amount),
        })),
        poNumber: order?.customerPONumber?.value,
      },
    });
  }

  return json({ error: "Invalid submission" }, { status: 400 });
};

// ----- Client: Component -----
export default function OrderExportRoute() {
  const fetcher = useFetcher<typeof action>();
  const data = fetcher.data;
  const { orderNumber } = useLoaderData<typeof loader>();
  const [orderId, setOrderId] = useState(orderNumber || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (orderNumber) {
      handleFetch();
    }
  }, [orderNumber]);

  const handleFetch = () => {
    if (!orderId) return;
    setIsLoading(true);
    fetcher.submit(
      { orderExport: "true", orderId },
      { method: "POST", encType: "application/x-www-form-urlencoded" },
    );
  };

  const scrubName = (name: string) =>
    name.replace(/[^a-zA-Z0-9 \\-]/g, "").trim();

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
      new Date(data.orderExportData.createdAt).toLocaleDateString("en-US"), // *DueDate
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
    const customerNameScrubbed = scrubName(data.orderExportData.customer);
    const fileName = `invoice_${data.orderExportData.name}-${data.orderExportData.poNumber}-${customerNameScrubbed}.csv`;
    a.download = `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page
      title={`QuickBooks Order Export${data?.orderExportData?.name ? ": #" + data.orderExportData.name : ""}`}
    >
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
            <p>
              Order #: <strong>{data.orderExportData.name}</strong>
            </p>
            <p>
              Created At:{" "}
              <strong>
                {new Date(data.orderExportData.createdAt).toLocaleString()}
              </strong>
            </p>
            <p>
              Fulfillment Status:{" "}
              <strong>{data.orderExportData.fulfillmentStatus}</strong>
            </p>
            {data.orderExportData.poNumber && (
              <p>
                PO #: <strong>{data.orderExportData.poNumber}</strong>
              </p>
            )}
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
