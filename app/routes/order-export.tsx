import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useState, useEffect } from "react";
import { TextField, Button, Card, Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  downloadCSVFile,
  getInvoiceCSVRows,
  invoiceCSVHeaders,
  getProductsCSVRows,
  productsCSVHeaders,
  sanitizeFilename,
} from "../utils/csvExport";
import { getOrderByQuery } from "./order-export.query";

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

    const orderResponse = await admin.graphql(getOrderByQuery, {
      variables: { query },
    });

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
          sku: node.variant?.sku || "",
          category: node.variant?.product?.productType || "",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderId, orderName]);

  const handleFetch = () => {
    if (!orderNameState && !orderIdState) return;
    setIsLoading(true);
    fetcher.submit(
      { orderExport: "true", orderName: orderNameState, orderId: orderIdState },
      { method: "POST", encType: "application/x-www-form-urlencoded" },
    );
  };

  useEffect(() => {
    if (fetcher.state === "idle") setIsLoading(false);
  }, [fetcher.state]);

  const downloadCSV = () => {
    if (!data?.orderExportData) return;
    const fileName = `invoice_${data.orderExportData.name}-${sanitizeFilename(data.orderExportData.customer)}.csv`;
    downloadCSVFile(
      invoiceCSVHeaders,
      getInvoiceCSVRows(data.orderExportData),
      fileName,
    );
  };

  const downloadProductsCSV = () => {
    if (!data?.orderExportData) return;
    const fileName = `products_${data.orderExportData.name}-${sanitizeFilename(data.orderExportData.customer)}.csv`;
    downloadCSVFile(
      productsCSVHeaders,
      getProductsCSVRows(data.orderExportData),
      fileName,
    );
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
            <Button onClick={downloadProductsCSV}>Download Products CSV</Button>
          </>
        )}

        {data?.error && <p style={{ color: "red" }}>⚠️ {data.error}</p>}
      </Card>
    </Page>
  );
}
