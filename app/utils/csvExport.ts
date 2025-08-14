// Utility functions for generating and downloading CSV files for order export
// Allows order-export.tsx to focus on UI/state and reuse CSV logic elsewhere

type LineItem = {
  title: string;
  quantity: number;
  currentQuantity: number;
  rate: number;
  wsPrice: number;
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

/**
 * Sanitizes text for QuickBooks Online compatibility by ensuring only allowed characters are present.
 * 
 * Allowed characters: A-Z, a-z, 0-9, comma (,), period (.), question mark (?), at symbol (@), 
 * ampersand (&), exclamation point (!), hash (#), single quote ('), tilde (~), asterisk (*), 
 * space, underscore (_), minus/hyphen (-), semicolon (;), plus sign (+)
 * 
 * Transformations applied:
 * - Normalizes to ASCII by removing diacritics (é -> e, ö -> o)
 * - Replaces trademark symbols: ™ -> " TM", ℠ -> " SM"
 * - Replaces copyright symbols: © -> " C", ® -> " R", ℗ -> " P"
 * - Normalizes dashes: em dash (—) and en dash (–) -> hyphen (-)
 * - Normalizes quotes: curly quotes (" " ' ') -> straight single quote (')
 * - Replaces ellipsis (…) -> "..."
 * - Replaces degree symbol (°) -> " deg"
 * - Replaces fractions: ½ -> "1/2", ¼ -> "1/4", ¾ -> "3/4"
 * - Replaces colons (:) -> hyphens (-)
 * - Removes any remaining disallowed characters
 * - Collapses multiple spaces to single space and trims
 * 
 * @param value The text to sanitize
 * @returns Sanitized text compatible with QuickBooks Online
 * 
 * @example
 * sanitizeQBOText("ACME™ Widget – 12"") // -> "ACME TM Widget - 12'"
 * sanitizeQBOText("SKU®123") // -> "SKU R123"
 * sanitizeQBOText("Gadgets:New") // -> "Gadgets-New"
 */
export function sanitizeQBOText(value: string): string {
  if (!value || typeof value !== 'string') return "";
  
  let result = value;
  
  // Replace common symbols FIRST, before normalization which might remove them
  result = result.replace(/™/g, ' TM');           // Trademark  
  result = result.replace(/℠/g, ' SM');           // Service mark
  result = result.replace(/©/g, ' C');            // Copyright
  result = result.replace(/®/g, ' R');            // Registered
  result = result.replace(/℗/g, ' P');            // Sound recording copyright
  
  // Replace other symbols before normalization
  result = result.replace(/…/g, '...');           // Ellipsis
  result = result.replace(/°/g, ' deg');          // Degree symbol
  
  // Replace fractions with text (since forward slash is not in allowed characters)
  result = result.replace(/½/g, ' half');
  result = result.replace(/¼/g, ' quarter');
  result = result.replace(/¾/g, ' three-quarters');
  
  // Normalize dashes
  result = result.replace(/[—–]/g, '-');          // Em dash and en dash to hyphen
  
  // Normalize quotes - use Unicode escapes for reliability
  result = result.replace(/[\u201C\u201D\u201E\u201F]/g, "'");  // Double curly quotes to single quote
  result = result.replace(/[\u2018\u2019\u201A\u201B]/g, "'");  // Single curly quotes to single quote
  result = result.replace(/"/g, "'");             // Straight double quote to single quote
  
  // Replace colons (not allowed in QBO) with hyphens
  result = result.replace(/:/g, '-');
  
  // Now normalize to ASCII by removing diacritics (after special symbols are handled)
  result = result.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  
  // Remove any remaining characters not in the allowed set
  // Allowed: A-Z, a-z, 0-9, comma, period, question mark, at symbol, ampersand,
  // exclamation point, hash, single quote, tilde, asterisk, space, underscore, 
  // minus/hyphen, semicolon, plus sign
  result = result.replace(/[^A-Za-z0-9,.?@&!#'~* _\-;+]/g, '');
  
  // Collapse multiple spaces to single space and trim
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/** Download CSV helper */
export function downloadCSVFile(headers: string[], rows: (string | number)[][], filename: string, p0?: {
  data: ({ error: string; } & {}) | ({
    orderExportData: {} & {
      name?: any;
      // Allows order-export.tsx to focus on UI/state and reuse CSV logic elsewhere
      customer?: any; createdAt?: any; lineItems?: any; poNumber?: any;
    };
  } & {}); "": any;
}) {
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
  return order.lineItems.map(item => {
    const sanitizedTitle = sanitizeQBOText(item.title || "");
    const sanitizedCategory = sanitizeQBOText(item.category || "");
    const sanitizedSku = sanitizeQBOText(item.sku || "");

    const today = new Date().toLocaleDateString("en-US");
 //   const halfRateRoundedTo0_5 = Math.round(item.rate / 2 / 0.5) * 0.5; // number
    const itemRateStr =item.wsPrice.toFixed(2);                // string
    const itemAmountStr = (item.currentQuantity * item.wsPrice).toFixed(2); // string 

    return [
      order.name,                       // InvoiceNo (string)
      order.customer,                   // Customer (string)
      today,                            // InvoiceDate (string)
      today,                            // DueDate (string)
      "Due on Receipt",                 // Terms (string)
      "",                               // Location (string)
      order.poNumber ?? "",             // Memo (string, avoid undefined)
      sanitizedTitle,                   // ProductName (string)
      `${sanitizedCategory}:${sanitizedTitle}`, // Item(Product/Service) (string)
      sanitizedSku,                     // ItemDescription (string)
      item.currentQuantity,             // ItemQuantity (number)
      itemRateStr,                      // ItemRate (string)
      itemAmountStr,                    // ItemAmount (string)
      "N",                              // Taxable (string)
      "",                               // TaxRate (string)
      "",                               // Shipping address (string)
      "FedEx",                          // Ship via (string)
      today,                            // Shipping date (string)
      "",                               // Tracking no (string)
      "",                               // Shipping Charge (string)
      "",                               // Service Date (string)
    ];
  });
}


export const invoiceCSVHeaders = [
  "InvoiceNo",
  "Customer",
  "InvoiceDate",
  "DueDate",
  "Terms",
  "Location",
  "Memo",
  "ProductName",
  "Item(Product/Service)",
  "ItemDescription",
  "ItemQuantity",
  "ItemRate",
  "ItemAmount",
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
  return order.lineItems.map(item => {
    const sanitizedTitle = sanitizeQBOText(item.title || '');
    const sanitizedSku = sanitizeQBOText(item.sku || '');
    const sanitizedCategory = sanitizeQBOText(item.category || '');
    
    return [
      sanitizedTitle, // Product/Service Name
      "N", // Buy
      "Y", // Sell
      "Non‑Inventory",
      sanitizedSku, // SKU
      item.rate.toFixed(2),
      "",
      "Sales",
      "Cost of Goods Sold",
      sanitizedCategory, // Category
      //"",
      //today,
      sanitizedTitle, // Sales description
      "",
      "",
      "",
      "",
    ];
  });
}

export const productsCSVHeaders = [
  "Product/Service Name",
  "Buy",
  "Sell",
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