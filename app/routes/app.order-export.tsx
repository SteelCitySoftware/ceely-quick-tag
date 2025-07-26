import { useState, useEffect } from "react";
import { TextField, Button, Card, Page } from "@shopify/polaris";

export default function OrderExportRoute() {
  const [orderId, setOrderId] = useState("");
  const [orderData, setOrderData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrder = async () => {
    if (!orderId) return;
    setIsLoading(true);
    const response = await fetch("/order-export", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ orderExport: "true", orderId }).toString(),
    });
    const result = await response.json();
    setOrderData(result.orderExportData);
    setIsLoading(false);
  };

  const downloadCSV = () => {
    if (!orderData) return;
    const headers = [
      "Invoice #",
      "Customer",
      "Description",
      "Quantity",
      "Rate",
      "Amount",
    ];
    const rows = orderData.lineItems.map((item) => [
      orderData.name,
      orderData.customer,
      item.title,
      item.quantity,
      item.rate,
      item.quantity * item.rate,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice_${orderData.name}.csv`;
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
        <Button onClick={fetchOrder} loading={isLoading} primary>
          Fetch Order
        </Button>

        {orderData && (
          <>
            <p>Customer: {orderData.customer}</p>
            <ul>
              {orderData.lineItems.map((item, idx) => (
                <li key={idx}>
                  {item.quantity} x {item.title} @ ${item.rate} = $
                  {item.quantity * item.rate}
                </li>
              ))}
            </ul>
            <Button onClick={downloadCSV}>Download QuickBooks CSV</Button>
          </>
        )}
      </Card>
    </Page>
  );
}
