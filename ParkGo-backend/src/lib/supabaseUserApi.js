import { config } from "./config.js";

const buildHeaders = () => {
  // Use service key to bypass Row Level Security; fall back to anon key if not set
  const key = config.supabaseServiceKey || config.supabaseAnonKey;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
};

export async function findUserByEmail(email) {
  const url = new URL(`${config.supabaseUrl}/rest/v1/user`); 
  url.searchParams.set(
    "select",
    "id,email,password,first_name,last_name,phone_number,user_type"
  );
  url.searchParams.set("email", `eq.${email}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase user lookup failed: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  const users = await response.json();
  return users[0] || null;
}
