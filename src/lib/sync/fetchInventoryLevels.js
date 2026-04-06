import { shopifyGraphQL } from "@/lib/sync/shopifyHelpers";

const INVENTORY_LEVELS_QUERY = `
  query GetInventoryLevels($cursor: String) {
    inventoryItems(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        inventoryLevels(first: 20) {
          nodes {
            updatedAt
            location {
              id
            }
            quantities(names: ["available"]) {
              name
              quantity
            }
          }
        }
      }
    }
  }
`;

export default async function fetchInventoryLevels() {
  const allLevels = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyGraphQL(INVENTORY_LEVELS_QUERY, { cursor });
    const { nodes, pageInfo } = data.inventoryItems;

    for (const item of nodes) {
      for (const level of item.inventoryLevels.nodes) {
        const availableEntry = level.quantities.find(
          (q) => q.name === "available"
        );

        allLevels.push({
          shopify_inventory_item_id: item.id,
          shopify_location_id: level.location.id,
          available: availableEntry?.quantity ?? null,
          updated_at_shopify: level.updatedAt,
        });
      }
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return allLevels;
}