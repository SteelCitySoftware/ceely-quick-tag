import { useEffect } from "react";

export default function useFocusManagement() {
  useEffect(() => {
    const handleFocusChange = (event: FocusEvent) => {
      const focusedElement = document.activeElement as HTMLElement | null;
      const tagField = document.getElementById("tagField");
      const barcodeField = document.getElementById("barcodeField");

      // Allow focus on buttons or summaries
      if (
        focusedElement !== tagField &&
        focusedElement !== barcodeField //&&
        //!["BUTTON", "SUMMARY"].includes(focusedElement?.tagName || "")
      ) {
        // Delay focus reset
        setTimeout(() => {
          barcodeField?.focus();
        }, 5000); // Adjust delay if needed
      }
    };

    document.addEventListener("focusin", handleFocusChange);

    return () => {
      document.removeEventListener("focusin", handleFocusChange);
    };
  }, []);
}
