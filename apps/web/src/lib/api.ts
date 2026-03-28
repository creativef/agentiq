export async function apiGet(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}
