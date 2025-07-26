import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useState, useEffect } from "react";
import { TextField, Button, Card, Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useFetcher, useLoaderData } from "@remix-run/react";

// ----- Server: loader -----
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const orderName = url.searchParams.get("order_number");
  const orderId = url.searchParams.get("id");

  return json({ orderName, orderId });
};

// ----- Server: action -----
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get("orderExport") === "true") {
    const orderName = formData.get("orderName")?.toString();
    const orderId = formData.get("orderId")?.toString();

    let query;
    if (orderId) {
      query = `id:${orderId}`;
    } else if (orderName) {
      query = `name:${orderName.replace(/^#/, "")}`;
    } else {
      return json({ error: "Missing order identifier" }, { status: 400 });
    }

    const orderResponse = await admin.graphql(
      `#graphql
      query getOrderByQuery($query: String!) {
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
  const { orderName, orderId: initialOrderId } = useLoaderData<typeof loader>();
  const [orderNameState, setOrderNameState] = useState(orderName || "");
  const [orderIdState, setOrderIdState] = useState(initialOrderId || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialOrderId) {
      setOrderIdState(initialOrderId);
      setTimeout(handleFetch, 0);
    } else if (orderName) {
      setOrderNameState(orderName);
      setTimeout(handleFetch, 0);
    }
  }, [initialOrderId, orderName]);

  const handleFetch = () => {
    if (!orderNameState && !orderIdState) return;
    setIsLoading(true);
    fetcher.submit(
      { orderExport: "true", orderName: orderNameState, orderId: orderIdState },
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
      item.rate.toFixed(2), // ItemRate
      (item.quantity * item.rate.toFixed(2)).toFixed(2), // *ItemAmount
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
    const fileName = `invoice_${data.orderExportData.name}-${customerNameScrubbed}.csv`;
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
          value={orderNameState}
          onChange={setOrderNameState}
          autoComplete="off"
          disabled={isLoading}
        />
        <TextField
          label="Internal Order ID"
          value={orderIdState}
          onChange={setOrderIdState}
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
            {data.orderExportData.poNumber && (
              <p>
                PO #: <strong>{data.orderExportData.poNumber}</strong>
              </p>
            )}
            <p>Customer: {data.orderExportData.customer}</p>
            <ul>
              {data.orderExportData.lineItems.map((item, idx) => (
                <li key={idx}>
                  {item.quantity} x {item.title} @ ${item.rate.toFixed(2)} = $
                  {(item.quantity * item.rate).toFixed(2)}
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
