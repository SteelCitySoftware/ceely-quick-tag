import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useState, useEffect } from "react";
import { TextField, Button, Card, Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useFetcher, useLoaderData } from "@remix-run/react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const orderNumber = url.searchParams.get("order_number");
  const action = url.searchParams.get("action");
  return json({ orderNumber, action });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get("orderExport") === "true") {
    const orderName = formData.get("orderId")?.toString();
    const query = `name:${orderName.replace(/^#/, "")}`;

    const orderResponse = await admin.graphql(
      `#graphql
      query getOrderByName($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              id
              name
              customer { displayName }
              createdAt
              lineItems(first: 100) {
                edges {
                  node {
                    title
                    quantity
                    originalUnitPriceSet { shopMoney { amount } }
                  }
                }
              }
            }
          }
        }
      }`,
      { variables: { query } },
    );

    const orderEdges = (await orderResponse.json()).data.orders.edges;
    const order = orderEdges?.[0]?.node;

    if (!order) {
      return json({ error: "Order not found" }, { status: 404 });
    }

    return json({
      orderExportData: {
        name: order.name,
        customer: order.customer?.displayName || "Guest",
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

export default function OrderExportRoute() {
  const fetcher = useFetcher<typeof action>();
  const data = fetcher.data;
  const { orderNumber, action } = useLoaderData<typeof loader>();
  const [orderId, setOrderId] = useState(orderNumber || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (orderNumber) {
      setOrderId(orderNumber);
      setTimeout(handleFetch, 0);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (action === "download_csv" && data?.orderExportData) {
      downloadCSV();
    }
  }, [action, data]);

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
      data.orderExportData.name,
      data.orderExportData.customer,
      new Date(data.orderExportData.createdAt).toLocaleDateString("en-US"),
      new Date(data.orderExportData.createdAt).toLocaleDateString("en-US"),
      "",
      "",
      "",
      item.title,
      "",
      item.quantity,
      item.rate.toFixed(2),
      (item.quantity * item.rate).toFixed(2),
      "N",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const customerNameScrubbed = scrubName(data.orderExportData.customer);
    const fileName = `invoice_${data.orderExportData.name}-${customerNameScrubbed}.csv`;
    a.download = `${fileName}`;
    a.click();
    URL.revokeObjectURL(url);
    setIsLoading(false);
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
        <Button onClick={handleFetch} loading={isLoading} primary>
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
