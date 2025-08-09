import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useState, useEffect, useCallback } from "react";
import {
  BlockStack,
  Text,
  TextField,
  Button,
  Card,
  Page,
  Layout,
  Banner,
  InlineError,
  Spinner,
} from "@shopify/polaris";
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

    // Extra null checks for safety
    return json({
      orderExportData: {
        name: order.name,
        customer:
          order.customer?.quickbooksName?.value ||
          order.customer?.displayName ||
          "Guest",
        createdAt: order.createdAt,
        lineItems: Array.isArray(order.lineItems?.edges)
          ? order.lineItems.edges.map(({ node }) => ({
              title: node.title,
              quantity: node.quantity,
              currentQuantity: node.currentQuantity,
              rate: parseFloat(
                node.originalUnitPriceSet?.shopMoney?.amount ?? "0",
              ),
              sku: node.variant?.sku || "",
              category: node.variant?.product?.productType || "",
            }))
          : [],
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
  const [inputError, setInputError] = useState<string | undefined>();
  const [showDetails, setShowDetails] = useState(false);

  // 4x6 Label: total carton count (for "1 of X")
  const [totalCartons, setTotalCartons] = useState<string>("1");

  const handleFetch = useCallback(() => {
    if (!orderNameState && !orderIdState) {
      setInputError("Please enter an Order Name or Order ID.");
      return;
    }
    setInputError(undefined);
    setIsLoading(true);
    setShowDetails(false);
    fetcher.submit(
      {
        orderExport: "true",
        orderName: orderNameState,
        orderId: orderIdState,
      },
      { method: "post" },
    );
  }, [fetcher, orderNameState, orderIdState]);

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

  useEffect(() => {
    if (fetcher.state === "idle") {
      setIsLoading(false);
      if (fetcher.data?.orderExportData) setShowDetails(true);
    }
  }, [fetcher.state, fetcher.data]);

  const onPrintLabel = () => {
    // Print just the label area using CSS below
    window.print();
  };

  const cartonsInt = Math.max(1, Number.parseInt(totalCartons || "1", 10) || 1);

  return (
    <Page title="Order Export">
      {/* Print styles for 4x6 label */}
      <style>{`
        @page { size: 4in 6in; margin: 0; }
        @media print {
          body * { visibility: hidden; }
          #label-4x6, #label-4x6 * { visibility: visible; }
          #label-4x6 { position: absolute; inset: 0; }
        }
      `}</style>

      <Layout>
        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Export Shopify Order to QuickBooks
              </Text>
              <Text as="p">
                Enter an Order Name (like <code>#1001</code>) or an Order ID to
                fetch the order and export details in QuickBooks-friendly CSV
                format.
              </Text>
              <TextField
                label="Order Name (e.g. #1001)"
                value={orderNameState}
                onChange={setOrderNameState}
                autoComplete="off"
                disabled={isLoading}
              />
              <TextField
                label="Order ID"
                value={orderIdState}
                onChange={setOrderIdState}
                autoComplete="off"
                disabled={isLoading}
              />
              {inputError && (
                <InlineError message={inputError} fieldID="orderName" />
              )}
              <Button onClick={handleFetch} loading={isLoading} primary>
                Fetch Order
              </Button>
              {isLoading && (
                <Spinner
                  accessibilityLabel="Loading order details"
                  size="small"
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {showDetails && data?.orderExportData && (
            <>
              <Card
                sectioned
                title={`Export for Order: ${data.orderExportData.name}`}
              >
                <BlockStack gap="400">
                  <Banner
                    status="success"
                    title="Order loaded and ready for export."
                  />
                  <Text as="h3" variant="headingMd">
                    Customer:{" "}
                    <Text as="span" fontWeight="bold">
                      {data.orderExportData.customer}
                    </Text>
                  </Text>
                  <Text as="p">
                    Created At:{" "}
                    {new Date(data.orderExportData.createdAt).toLocaleString()}
                  </Text>
                  {data.orderExportData.poNumber && (
                    <Text as="p">
                      <strong>PO Number:</strong> {data.orderExportData.poNumber}
                    </Text>
                  )}
                  <Button
                    onClick={() =>
                      downloadCSVFile(
                        invoiceCSVHeaders,
                        getInvoiceCSVRows(data.orderExportData),
                        `${sanitizeFilename(data.orderExportData.customer)}-${sanitizeFilename(data.orderExportData.name)}${data.orderExportData.poNumber?.trim() ? `-${sanitizeFilename(data.orderExportData.poNumber?.trim())}` : ""}-invoice.csv`,
                      )
                    }
                    size="medium"
                  >
                    Download Invoice CSV
                  </Button>
                  <Button
                    onClick={() =>
                      downloadCSVFile(
                        productsCSVHeaders,
                        getProductsCSVRows(data.orderExportData),
                        `${sanitizeFilename(data.orderExportData.customer)}-${sanitizeFilename(data.orderExportData.name)}${data.orderExportData.poNumber?.trim() ? `-${sanitizeFilename(data.orderExportData.poNumber?.trim())}` : ""}-products.csv`,
                      )
                    }
                    size="medium"
                  >
                    Download Products CSV
                  </Button>

                  <Text as="h3" variant="headingMd">
                    Line Items
                  </Text>
                  <BlockStack as="ul" gap="100">
                    {data.orderExportData.lineItems.map((item, idx) => (
                      <li key={idx}>
                        <Text as="span">
                          {item.quantity != item.currentQuantity && (
                            <em>
                              <s>{item.quantity}</s>&nbsp;
                            </em>
                          )}
                          {item.currentQuantity} x {item.title} @
                          <s>${item.rate.toFixed(2)}</s>&nbsp;$
                          {(Math.round(item.rate / 2 / 0.5) * 0.5).toFixed(2)} = $
                          {(
                            item.currentQuantity *
                            (Math.round(item.rate / 2 / 0.5) * 0.5)
                          ).toFixed(2)}
                        </Text>
                      </li>
                    ))}
                    {data.orderExportData.lineItems.length === 0 && (
                      <Text as="p">No line items found for this order.</Text>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* 4x6 Label Card */}
              <Card title="4×6 Label" sectioned>
                <BlockStack gap="400">
                  <Text as="p">
                    Configure and print a 4×6 inch carton label for this order.
                  </Text>

                  <TextField
                    label="Total cartons (X for \"1 of X\")"
                    type="number"
                    min={1}
                    value={totalCartons}
                    onChange={setTotalCartons}
                    autoComplete="off"
                  />

                  {/* On-screen preview sized proportionally */}
                  <div
                    style={{
                      border: "1px solid #D9D9D9",
                      background: "#fff",
                      width: "300px", // 2:3 ratio preview (approx 4x6)
                      height: "450px",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontFamily: "monospace",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text as="span" variant="headingMd">ORDER</Text>
                      <Text as="span" variant="headingMd">{data.orderExportData.name}</Text>
                    </div>

                    {data.orderExportData.poNumber && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text as="span" variant="bodyMd">PO#</Text>
                        <Text as="span" variant="bodyMd">{data.orderExportData.poNumber}</Text>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                      <Text as="span" variant="headingMd">CARTON</Text>
                      <Text as="span" variant="headingMd">1 of {cartonsInt}</Text>
                    </div>

                    <div style={{
                      marginTop: "auto",
                      textAlign: "center",
                      borderTop: "1px dashed #999",
                      paddingTop: "12px",
                    }}>
                      <Text as="p" variant="headingLg" fontWeight="bold">
                        MIXED CARTON
                      </Text>
                    </div>
                  </div>

                  <Button onClick={onPrintLabel} primary>
                    Print 4×6 Label
                  </Button>

                  {/* Print-only exact 4x6 label */}
                  <div
                    id="label-4x6"
                    style={{
                      width: "4in",
                      height: "6in",
                      padding: "0.25in",
                      background: "#fff",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.1in",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontSize: "16pt", fontWeight: 700 }}>ORDER</div>
                      <div style={{ fontSize: "18pt", fontWeight: 700 }}>
                        {data.orderExportData.name}
                      </div>
                    </div>

                    {data.orderExportData.poNumber && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ fontSize: "12pt" }}>PO#</div>
                        <div style={{ fontSize: "12pt" }}>{data.orderExportData.poNumber}</div>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.1in" }}>
                      <div style={{ fontSize: "16pt", fontWeight: 700 }}>CARTON</div>
                      <div style={{ fontSize: "18pt", fontWeight: 700 }}>1 of {cartonsInt}</div>
                    </div>

                    <div style={{ marginTop: "auto", textAlign: "center", borderTop: "1px dashed #000", paddingTop: "0.15in" }}>
                      <div style={{ fontSize: "26pt", fontWeight: 800, letterSpacing: "1px" }}>
                        MIXED CARTON
                      </div>
                    </div>
                  </div>
                </BlockStack>
              </Card>
            </>
          )}
          {data?.error && (
            <Card sectioned>
              <Banner status="critical" title="Error">
                {data.error}
              </Banner>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
