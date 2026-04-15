import { shopifyGraphQL } from "@/lib/sync/shopifyHelpers";

const INVENTORY_ITEMS_QUERY = `
  query GetInventoryItems($cursor: String) {
    inventoryItems(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        sku
        tracked
        unitCost {
          amount
          currencyCode
        }
        countryCodeOfOrigin
        harmonizedSystemCode
        variant {
          id
        }
      }
    }
  }
`;

export default async function fetchInventoryItems(credentials = {}) {
  const allItems = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyGraphQL(INVENTORY_ITEMS_QUERY, { cursor }, credentials);
    const { nodes, pageInfo } = data.inventoryItems;

    allItems.push(...nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return allItems;
}
