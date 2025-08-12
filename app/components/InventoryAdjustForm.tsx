import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";

interface InventoryAdjustFormProps {
  inventoryLevelName: string;
  label: string;
  quantity: number;
  levelId: string;
  locationId: string;
}


interface FetcherData {
  success?: boolean;
  adjustmentResult?: {
    quantityAfterChange?: number;
    productId?: string;
  };
}
export function InventoryAdjustForm({
  inventoryLevelName,
  label,
  quantity,
  levelId,
  locationId,
}: InventoryAdjustFormProps) {
  const fetcher = useFetcher();
  const [originalQty, setOriginalQty] = useState(quantity);
  const [inputQty, setInputQty] = useState(quantity);
  const delta = inputQty - originalQty;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      const newQty = fetcher.data?.adjustmentResult?.quantityAfterChange;
      const productId = fetcher.data?.adjustmentResult?.productId;

      if (typeof newQty === "number") {
        setInputQty(newQty); // update the field
        setOriginalQty(newQty); // reset the base for delta
      }

      if (productId) {
        // Optional: refresh the product
        fetcher.submit({ productId }, { method: "POST" });
      }
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <form
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isNaN(delta) && delta !== 0) {
          fetcher.submit(
            {
              adjustInventory: "true",
              inventoryLevelName,
              levelId,
              locationId,
              delta: String(delta),
              currentQty: String(quantity),
            },
            { method: "post", encType: "application/x-www-form-urlencoded" },
          );
        }
      }}
      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
    >
      {label}
      <input
        type="number"
        name={`newQty-${levelId}-${locationId}`}
        value={inputQty}
        onChange={(e) => setInputQty(Number(e.target.value))}
        style={{ width: "60px" }}
        className="inventory-adjust-input"
      />
      <button type="submit" disabled={delta === 0}>
        {delta > 0 ? `+${delta}` : delta}
      </button>
    </form>
  );
}