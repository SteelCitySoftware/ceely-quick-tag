import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ReactNode } from "react";
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
  DataTable,
  Box,
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

// ------------------ Types ------------------
type LineItem = {
  title: string;
  quantity: number;
  currentQuantity: number;
  rate: number;
  sku: string;
  category: string;
};

type OrderExportData = {
  name: string;
  customer: string;
  createdAt: string;
  lineItems: LineItem[];
  poNumber?: string; // normalized to undefined (no null)
};

type ActionData = { orderExportData: OrderExportData } | { error: string };
type LoaderData = { orderName: string | null; orderId: string | null };

// GraphQL node type used when mapping edges
type GqlLineItemNode = {
  title: string;
  quantity: number;
  currentQuantity: number;
  originalUnitPriceSet?: {
    shopMoney?: { amount?: string | null } | null;
  } | null;
  variant?: {
    sku?: string | null;
    product?: { productType?: string | null } | null;
  } | null;
};

// ------------------ Server: loader ------------------
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const orderName = url.searchParams.get("order_number");
  const orderId = url.searchParams.get("id");
  const data: LoaderData = { orderName, orderId };
  return json<LoaderData>(data);
};

// ------------------ Server: action ------------------
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get("orderExport") === "true") {
    const orderName = formData.get("orderName")?.toString();
    const orderId = formData.get("orderId")?.toString();

    let query: string;
    if (orderId) {
      query = `id:${orderId}`;
    } else if (orderName) {
      query = `name:${orderName.replace(/^#/, "")}`;
    } else {
      return json<ActionData>(
        { error: "Missing order identifier" },
        { status: 400 },
      );
    }

    const orderResponse = await admin.graphql(getOrderByQuery, {
      variables: { query },
    });
    // We only need the first order
    const orderEdges = (await orderResponse.json()).data?.orders?.edges as
      | Array<{ node: any }>
      | undefined;

    const order = orderEdges?.[0]?.node;
    if (!order) {
      return json<ActionData>({ error: "Order not found" }, { status: 404 });
    }

    const lineItems: LineItem[] = Array.isArray(order.lineItems?.edges)
      ? (order.lineItems.edges as Array<{ node: GqlLineItemNode }>).map(
          ({ node }) => ({
            title: node.title,
            quantity: node.quantity,
            currentQuantity: node.currentQuantity,
            rate: parseFloat(
              node.originalUnitPriceSet?.shopMoney?.amount ?? "0",
            ),
            sku: node.variant?.sku ?? "",
            category: node.variant?.product?.productType ?? "",
          }),
        )
      : [];

    return json<ActionData>({
      orderExportData: {
        name: order.name,
        customer:
          order.customer?.quickbooksName?.value ||
          order.customer?.displayName ||
          "Guest",
        createdAt: order.createdAt,
        lineItems,
        poNumber: order?.customerPONumber?.value ?? undefined, // normalize to undefined
      },
    });
  }

  return json<ActionData>({ error: "Invalid submission" }, { status: 400 });
};

// ------------------ Client: Component ------------------
export default function OrderExportRoute() {
  const fetcher = useFetcher<ActionData>();
  const { orderName, orderId: initialOrderId } = useLoaderData<LoaderData>();
  const data = fetcher.data;

  // Narrow the union {orderExportData}|{error}
  const orderData: OrderExportData | undefined =
    data && "orderExportData" in data ? data.orderExportData : undefined;
  const actionError: string | undefined =
    data && "error" in data ? data.error : undefined;

  const [orderNameState, setOrderNameState] = useState(orderName || "");
  const [orderIdState, setOrderIdState] = useState(initialOrderId || "");
  const [isLoading, setIsLoading] = useState(false);
  const [inputError, setInputError] = useState<string | undefined>();
  const [showDetails, setShowDetails] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // 4×6 label state
  const [cartonCount, setCartonCount] = useState<number>(1);

  // Use existing data if present
  const orderLabel = orderData?.name ?? orderNameState ?? "";
  const poFromOrder = orderData?.poNumber?.trim() || "";

  const onPrintLabels = () => {
    if (!orderData) return; // guard
    if (cartonCount <= 0 || !printRef.current) return;

    const content = printRef.current.innerHTML?.trim();
    if (!content) {
      console.warn("No label HTML to print");
      return;
    }

    const html = `
  <html>
    <head>
      <title>${sanitizeFilename(data.orderExportData.customer)}-${sanitizeFilename(data.orderExportData.name)} - 4x6 Carton Labels</title>
      <meta charset="utf-8" />
      <style>
        @page { size: 4in 6in; margin: 0; }
        * { box-sizing: border-box; }
        html, body { height: 100%; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .print-sheet {
          width: 4in; height: 6in; page-break-after: always;
          display:flex; align-items:center; justify-content:center; padding:0.15in;
        }
        .label-4x6 { width:100%; height:100%; border:2px solid #000; border-radius:12px; display:flex; align-items:center; justify-content:center; }
        .label-inner { width:100%; height:100%; padding:0.2in; display:grid; grid-template-rows:auto auto auto 1fr auto; gap:0.08in; }
        .logo { text-align:center; }
        .logo img { max-width: 100%; height: auto; max-height: 1in; }
        .row { display:grid; grid-template-columns:0.9in 1fr; gap:0.14in; }
        .k { font-weight:700; font-size:20pt; }
        .v { font-size:25pt; word-break:break-word; }
        .count { align-self:center; justify-self:center; font-size:60pt; font-weight:800; }
        .mixed { align-self:end; text-align:center; font-size:50pt; font-weight:900; letter-spacing:1px; background:black; color:white; border-radius:12px; }
        @media print {
          .mixed {
            align-self: end !important;
            text-align: center !important;
            font-size: 50pt !important;
            font-weight: 900 !important;
            letter-spacing: 1px !important;
            background: black !important;
            color: white !important;
            border-radius: 12px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;

          }
        }
      </style>
    </head>
    <body>${content}</body>
  </html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;

    w.document.open();
    w.document.write(html);
    w.document.close();

    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {}
    }, 200);
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
      if (orderData) setShowDetails(true);
    }
  }, [fetcher.state, orderData]);

  // ---------- Line Items: Sortable DataTable ----------
  const [sortColumnIndex, setSortColumnIndex] = useState<number>(0);
  const [sortDirection, setSortDirection] = useState<
    "ascending" | "descending"
  >("ascending");

  // 50% rounded to nearest $0.50
  const wsCostCalc = useCallback(
    (rate: number) => Math.round(rate / 2 / 0.5) * 0.5,
    [],
  );

  type RowModel = {
    qtyDisplay: ReactNode; // with strike logic
    qtyValue: number; // for sorting
    product: string;
    sku: string;
    category: string;
    msrpDisplay: ReactNode; // <s>$..</s>
    msrpValue: number; // for sorting
    discount: string; // "50%"
    wsCostDisplay: string; // "$.."
    wsCostValue: number;
    totalDisplay: string; // "$.."
    totalValue: number;
  };

  const baseRows: RowModel[] = useMemo(() => {
    const items = orderData?.lineItems || [];
    return items.map((item: LineItem) => {
      const ws = wsCostCalc(item.rate);
      const total = item.currentQuantity * ws;
      return {
        qtyDisplay:
          item.quantity !== item.currentQuantity ? (
            <>
              <em>
                <s>{item.quantity}</s>&nbsp;
              </em>
              {item.currentQuantity}
            </>
          ) : (
            item.currentQuantity
          ),
        qtyValue: Number(item.currentQuantity) || 0,
        product: item.title || "",
        sku: item.sku || "",
        category: item.category || "",
        msrpDisplay: <s>${item.rate.toFixed(2)}</s>,
        msrpValue: Number(item.rate) || 0,
        discount: "50%",
        wsCostDisplay: `$${ws.toFixed(2)}`,
        wsCostValue: ws,
        totalDisplay: `$${total.toFixed(2)}`,
        totalValue: total,
      };
    });
  }, [orderData?.lineItems, wsCostCalc]);

  const sortedRows = useMemo(() => {
    const rows = [...baseRows];
    const dir = sortDirection === "ascending" ? 1 : -1;

    rows.sort((a, b) => {
      switch (sortColumnIndex) {
        case 0:
          return (a.qtyValue - b.qtyValue) * dir; // Qty
        case 1:
          return a.product.localeCompare(b.product) * dir; // Product
        case 2:
          return a.sku.localeCompare(b.sku) * dir; // SKU
        case 3:
          return a.category.localeCompare(b.category) * dir; // Category
        case 4:
          return (a.msrpValue - b.msrpValue) * dir; // MSRP
        case 5:
          return 0; // Discount fixed
        case 6:
          return (a.wsCostValue - b.wsCostValue) * dir; // WS Cost
        case 7:
          return (a.totalValue - b.totalValue) * dir; // Total
        default:
          return 0;
      }
    });

    return rows;
  }, [baseRows, sortColumnIndex, sortDirection]);

  const rowsForDataTable = useMemo(
    () =>
      sortedRows.map((r) => [
        r.qtyDisplay,
        r.product,
        r.sku,
        r.category,
        r.msrpDisplay,
        r.discount,
        r.wsCostDisplay,
        r.totalDisplay,
      ]),
    [sortedRows],
  );

  const handleSort = useCallback(
    (columnIndex: number, direction: "ascending" | "descending") => {
      setSortColumnIndex(columnIndex);
      setSortDirection(direction);
    },
    [],
  );

  return (
    <Page title="Order Export">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Export Shopify Order to QuickBooks
                </Text>
                <Text as="p">
                  Enter an Order Number or use the "Export to Quickbooks"
                  directly in the dropdown to fetch the order and export details
                  in QuickBooks-friendly CSV format.
                </Text>
                <TextField
                  label="Order Number (e.g. 142442)"
                  value={orderNameState}
                  onChange={setOrderNameState}
                  autoComplete="off"
                  disabled={isLoading}
                />
                <TextField
                  label="Internal Shopify ID (e.g. number in URL)"
                  value={orderIdState}
                  onChange={setOrderIdState}
                  autoComplete="off"
                  disabled={isLoading}
                />
                {inputError && (
                  <InlineError message={inputError} fieldID="orderName" />
                )}
                <Button
                  onClick={handleFetch}
                  loading={isLoading}
                  variant="primary"
                >
                  Fetch Order
                </Button>
                {isLoading && (
                  <Spinner
                    accessibilityLabel="Loading order details"
                    size="small"
                  />
                )}
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {showDetails && orderData && (
            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    4×6 Carton Labels
                  </Text>

                  <TextField
                    label="Number of cartons (X)"
                    type="number"
                    min="1"
                    value={String(cartonCount)}
                    onChange={(v) =>
                      setCartonCount(Math.max(1, Number(v) || 1))
                    }
                    autoComplete="off"
                  />

                  <Button onClick={onPrintLabels} variant="primary">
                    Print {String(cartonCount)} Label
                    {cartonCount > 1 ? "s" : ""}
                  </Button>
                  {/* On-screen preview
                  <div className="label-preview-grid">
                    {Array.from({ length: cartonCount }, (_, i) => (
                      <div className="label-4x6" key={`p-${i}`}>
                        <div className="label-inner">
                          <div className="row">
                            <div className="k">Invoice:</div>
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
                  </div> */}

                  {/* Print-only container (revealed by @media print) */}
                  <div ref={printRef} style={{ display: "none" }}>
                    {Array.from({ length: cartonCount }, (_, i) => (
                      <div className="print-sheet" key={i}>
                        <div className="label-4x6">
                          <div className="label-inner">
                            <div className="logo">
                              <img
                                src="https://cdn.shopify.com/s/files/1/0718/6789/files/Brutus_Monroe_Logo_wih_stroke_644x247_c266ecd4-e053-4c07-92e5-6061c1ee97c8_450x.png?v=1652891855"
                                alt="Store  Logo"
                              />
                            </div>
                            <div className="row">
                              <div className="k">Invoice:</div>
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
              </Box>
              <Box padding="400">
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    Export for Invoice: <strong>{orderData.name}</strong>
                  </Text>

                  <Banner tone="success">
                    <Text as="p" variant="bodyMd" fontWeight="bold">
                      Order loaded and ready for export.
                    </Text>
                  </Banner>

                  <Text as="h3" variant="headingMd">
                    Invoice:{" "}
                    <Text as="span" fontWeight="bold">
                      {orderData.name}
                    </Text>
                  </Text>
                  <Text as="h3" variant="headingMd">
                    Customer:{" "}
                    <Text as="span" fontWeight="bold">
                      {orderData.customer}
                    </Text>
                  </Text>
                  <Text as="p">
                    Created At: {new Date(orderData.createdAt).toLocaleString()}
                  </Text>
                  {orderData.poNumber && (
                    <Text as="p">
                      <strong>PO Number:</strong> {orderData.poNumber}
                    </Text>
                  )}

                  <BlockStack gap="200" inlineAlign="start">
                    <Button
                      onClick={() =>
                        downloadCSVFile(
                          invoiceCSVHeaders,
                          getInvoiceCSVRows(orderData),
                          `${sanitizeFilename(orderData.customer)}-${sanitizeFilename(orderData.name)}${
                            orderData.poNumber?.trim()
                              ? `-${sanitizeFilename(orderData.poNumber?.trim())}`
                              : ""
                          }-invoice.csv`,
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
                          getProductsCSVRows(orderData),
                          `${sanitizeFilename(orderData.customer)}-${sanitizeFilename(orderData.name)}${
                            orderData.poNumber?.trim()
                              ? `-${sanitizeFilename(orderData.poNumber?.trim())}`
                              : ""
                          }-products.csv`,
                        )
                      }
                      size="medium"
                    >
                      Download Products CSV
                    </Button>
                  </BlockStack>

                  <Text as="h3" variant="headingMd">
                    Line Items
                  </Text>

                  <DataTable
                    columnContentTypes={[
                      "text", // Qty (ReactNode)
                      "text", // Product
                      "text", // SKU
                      "text", // Category
                      "text", // MSRP (ReactNode)
                      "text", // Discount
                      "text", // WS Cost
                      "text", // Total
                    ]}
                    headings={[
                      "Qty",
                      "Product",
                      "SKU",
                      "Category",
                      "MSRP",
                      "Discount",
                      "WS Cost",
                      "Total",
                    ]}
                    rows={rowsForDataTable}
                    sortable={[true, true, true, true, true, false, true, true]}
                    defaultSortDirection="ascending"
                    initialSortColumnIndex={0}
                    onSort={handleSort}
                  />
                </BlockStack>
              </Box>
            </Card>
          )}

          {actionError && (
            <Card>
              <Box padding="400">
                <Banner tone="critical">
                  <Text as="p">{actionError}</Text>
                </Banner>
              </Box>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
