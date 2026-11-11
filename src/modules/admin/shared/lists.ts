/** Lists such as years, tiers, boards and grades are stored as JSON text. */
export function parseList(text: string | null | undefined): string[] {
  try {
    const value = JSON.parse(text ?? "[]");
    return Array.isArray(value) ? value.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export const toList = (items: string[]) => JSON.stringify(items);

/** Items typed into one box are trimmed and empty ones are dropped. */
export const cleanList = (items: string[]) => items.map((x) => x.trim()).filter(Boolean);
