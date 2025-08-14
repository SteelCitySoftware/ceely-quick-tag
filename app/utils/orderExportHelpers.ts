// Map of search term → normalized category
export const COORDINATING_CATEGORY_MAP: Record<string, string> = {
  "Stamp and Die": "Combo",
  "Stamp & Coordinating Die": "Combo",
  "Coordinating Products": "Combo",
  "Stamp": "Stamp",
  "Die": "Die",
  "Chipboard": "Chipboard",
  "Bundle": "Bundle",
};

export function pickCoordinatingCategory(variantTitle?: string | null): string | undefined {
  if (!variantTitle) return;
  const vt = variantTitle.toLowerCase();
  for (const key of Object.keys(COORDINATING_CATEGORY_MAP)) {
    if (vt.includes(key.toLowerCase())) {
      return COORDINATING_CATEGORY_MAP[key];
    }
  }
}