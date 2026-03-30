export async function apiGet(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export async function getCompanies() {
  return apiGet("/companies");
}

export async function getEvents() {
  return apiGet("/events");
}
