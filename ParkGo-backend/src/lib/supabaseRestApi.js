import { config } from "./config.js";

const headers = (extra = {}) => ({
  apikey: config.supabaseAnonKey,
  Authorization: `Bearer ${config.supabaseAnonKey}`,
  "Content-Type": "application/json",
  ...extra,
});

const buildUrl = (table, { select = "*", filters = {}, limit, order } = {}) => {
  const url = new URL(`${config.supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set("select", select);

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  if (limit) url.searchParams.set("limit", String(limit));
  if (order) url.searchParams.set("order", order);

  return url;
};

const parseResponse = async (response) => {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      payload?.message || payload?.hint || `${response.status} ${response.statusText}`
    );
  }

  return payload;
};

export async function selectRows(table, options = {}) {
  const response = await fetch(buildUrl(table, options), {
    method: "GET",
    headers: headers(),
  });

  return parseResponse(response);
}

export async function insertRow(table, data, { select = "*" } = {}) {
  const response = await fetch(buildUrl(table, { select }), {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(data),
  });

  const rows = await parseResponse(response);
  return rows?.[0] || null;
}

export async function updateRows(table, data, { filters = {}, select = "*" } = {}) {
  const response = await fetch(buildUrl(table, { filters, select }), {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(data),
  });

  return parseResponse(response);
}
