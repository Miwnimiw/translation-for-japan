/** Generates a unique id. Uses crypto.randomUUID when available (browser & modern Node). */
export function generateId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${uuid}`;
}
