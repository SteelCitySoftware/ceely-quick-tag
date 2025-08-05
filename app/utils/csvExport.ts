// Utility functions for generating and downloading CSV files for order export
// Allows order-export.tsx to focus on UI/state and reuse CSV logic elsewhere

type LineItem = {
  title: string;
  quantity: number;
  rate: number;
  sku: string;
  category: string;
};

type OrderExportData = {
  name: string;
  customer: string;
  createdAt: string;
  lineItems: LineItem[];
  poNumber?: string;
};

/** Helper to escape CSV values if needed */
function escapeCSV(value: string | number | undefined): string {
  if (value == null) return "";
  const str = value.toString();
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Download CSV helper */
export function downloadCSVFile(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers, ...rows].map(r => r.map(escapeCSV).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Invoice CSV rows generator */
export function getInvoiceCSVRows(order: OrderExportData): (string | number)[][] {
  return order.lineItems.map(item => [
    order.name, // InvoiceNo
    order.customer, // Customer
    new Date(order.createdAt).toLocaleDateString("en-US"), // InvoiceDate
    new Date(order.createdAt).toLocaleDateString("en-US"), // DueDate
    "", // Terms
    "", // Location
    "", // Memo
    item.title, // Item(Product/Service)
    item.category || "",
    "", // ItemDescription
    item.quantity, // ItemQuantity
    (Math.round(item.rate / 2 / 0.5) * 0.5).toFixed(2), // ItemRate
    (item.quantity * (Math.round(item.rate / 2 / 0.5) * 0.5).toFixed(2)).toFixed(2), // ItemAmount
    "N", // Taxable
    "", // TaxRate
    "", // Shipping address
    "FedEx", // Ship via
    "", // Shipping date
    "", // Tracking no
    "", // Shipping Charge
    "", // Service Date
  ]);
}

export const invoiceCSVHeaders = [
  "InvoiceNo",
  "Customer",
  "InvoiceDate",
  "DueDate",
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

/** Products CSV rows generator */
export function getProductsCSVRows(order: OrderExportData): (string | number)[][] {
  const today = new Date().toLocaleDateString("en-US");
  return order.lineItems.map(item => [
    item.title,
    "Non‑Inventory",
    item.sku || "",
    item.rate.toFixed(2),
    "",
    "Sales",
    "Cost of Goods Sold",
    item.category || "",
    //"",
    //today,
    item.title,
    "",
    "",
    "",
    "",
  ]);
}

export const productsCSVHeaders = [
  "Product/Service Name",
  "Item Type",
  "SKU",
  "Sales price/rate",
  "Purchase cost",
  "Income account",
  "Expense account",
  "Category",
  //"Quantity on hand",
  //"Quantity as‑of Date",
  "Sales description",
  "Purchase description",
  "Parent",
  "Option Name",
  "Option Value",
];

/** Sanitize file name helper */
export function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9 \\-]/g, "").trim();
}