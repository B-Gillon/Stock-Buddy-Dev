import axios from "axios";

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";

export async function shopifyGraphQL(query, variables = {}) {
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await axios.post(
    url,
    { query, variables },
    {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_TOKEN,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.data.errors) {
    console.error("GraphQL errors:", JSON.stringify(response.data.errors, null, 2));
    throw new Error("Shopify GraphQL error");
  }

  return response.data.data;
}

export async function shopifyRestGet(path, params = {}) {
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/${path}.json`;

  const response = await axios.get(url, {
    headers: {
      "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_TOKEN,
      "Content-Type": "application/json",
    },
    params,
  });

  return response.data;
}

export function gidToId(gid) {
  if (!gid) return null;
  const parts = gid.split("/");
  return parts[parts.length - 1];
}