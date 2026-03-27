/** Parse a price string like "$1,299.99" or "1299" into a number, or null if not found. */
export function parsePrice(text: string): number | null {
  const match = text.replace(/,/g, "").match(/\d+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}
