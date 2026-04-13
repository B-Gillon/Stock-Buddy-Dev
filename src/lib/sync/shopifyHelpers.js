// /src/lib/sync/shopifyHelpers.js

import axios from "axios";

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";

export async function shopifyGraphQL(query, variables = {}, credentials = {}) {
  const domain      = credentials.shopDomain  ?? process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = credentials.accessToken ?? process.env.SHOPIFY_ADMIN_API_TOKEN;

  const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await axios.post(
    url,
    { query, variables },
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
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

export async function shopifyRestGet(path, params = {}, credentials = {}) {
  const domain      = credentials.shopDomain  ?? process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = credentials.accessToken ?? process.env.SHOPIFY_ADMIN_API_TOKEN;

  const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/${path}.json`;

  const response = await axios.get(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
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
