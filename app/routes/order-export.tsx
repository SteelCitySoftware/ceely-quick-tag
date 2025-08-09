import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useState, useEffect, useCallback, useRef } from "react";
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
  const printRef = useRef<HTMLDivElement>(null);

  // 4×6 label state
  const [cartonCount, setCartonCount] = useState<number>(1);

  // Use existing data if present
  const orderExportData = data?.orderExportData;
  const orderLabel = orderExportData?.name ?? orderNameState ?? "";
  const poFromOrder = orderExportData?.poNumber?.trim() || "";

  const onPrintLabels = () => {
    if (cartonCount <= 0 || !printRef.current) return;

    const html = `
    <html>
      <head>
        <title>4x6 Carton Labels</title>
        <style>
          @page { size: 4in 6in; margin: 0; }
          * { box-sizing: border-box; }
          html, body { height: 100%; }
          body { margin: 0; font-family: Arial, sans-serif; }

          /* Each printed page is exactly one 4x6 */
          .print-sheet {
            width: 4in;
            height: 6in;
            page-break-after: always;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.15in;
          }

          .label-4x6 {
            width: 100%;
            height: 100%;
            border: 2px solid #000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .label-inner {
            width: 100%;
            height: 100%;
            padding: 0.2in;
            display: grid;
            grid-template-rows: auto auto 1fr auto;
            gap: 0.08in;
          }
          .row { display: grid; grid-template-columns: 0.9in 1fr; gap: 0.08in; }
          .k { font-weight: 700; font-size: 14pt; }
          .v { font-size: 18pt; word-break: break-word; }

          .count {
            align-self: center;
            justify-self: center;
            font-size: 40pt;
            font-weight: 800;
          }
          .mixed {
            align-self: end;
            text-align: center;
            font-size: 20pt;
            font-weight: 700;
            letter-spacing: 1px;
          }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
      </body>
    </html>
  `;

    const w = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=800,height=600",
    );
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

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

  return (
    <Page title="Order Export">
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
              <Card title="4×6 Carton Labels" sectioned>
                <BlockStack gap="400">
                  <TextField
                    label="Number of cartons (X)"
                    type="number"
                    min={1}
                    value={String(cartonCount)}
                    onChange={(v) =>
                      setCartonCount(Math.max(1, Number(v) || 1))
                    }
                    autoComplete="off"
                  />
                  <Button onClick={onPrintLabels} primary>
                    Print {cartonCount} Label{cartonCount > 1 ? "s" : ""}
                  </Button>

                  {/* On-screen preview */}
                  <div className="label-preview-grid">
                    {Array.from({ length: cartonCount }, (_, i) => (
                      <div className="label-4x6" key={`p-${i}`}>
                        <div className="label-inner">
                          <div className="row">
                            <div className="k">Order:</div>
                            <div className="v">{orderLabel}</div>
                          </div>
                          {poFromOrder && (
                            <div className="row">
                              <div className="k">PO#:</div>
                              <div className="v">{poFromOrder}</div>
                            </div>
                          )}
                          <div className="count">
                            {i + 1} of {cartonCount}
                          </div>
                          <div className="mixed">MIXED CARTON</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Print-only container (revealed by @media print) */}
                  <div ref={printRef}>
                    {Array.from({ length: cartonCount }, (_, i) => (
                      <div className="print-sheet" key={`s-${i}`}>
                        <div className="label-4x6">
                          <div className="label-inner">
                            <div className="row">
                              <div className="k">Order:</div>
                              <div className="v">{orderLabel}</div>
                            </div>
                            {poFromOrder && (
                              <div className="row">
                                <div className="k">PO#:</div>
                                <div className="v">{poFromOrder}</div>
                              </div>
                            )}
                            <div className="count">
                              {i + 1} of {cartonCount}
                            </div>
                            <div className="mixed">MIXED CARTON</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </BlockStack>
              </Card>
            </Card>
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
