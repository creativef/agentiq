export function normalizeEvent(raw: { type: string; data: any }) {
  return { type: raw.type, payload: raw.data, sourceId: raw.data?.id ?? null };
}
