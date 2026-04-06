import { shopifyGraphQL } from "@/lib/sync/shopifyHelpers";

const LOCATIONS_QUERY = `
  query GetLocations($cursor: String) {
    locations(first: 50, after: $cursor, includeLegacy: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        isActive
        address {
          address1
          address2
          city
          province
          country
          zip
        }
        fulfillmentService {
          serviceName
          inventoryManagement
          trackingSupport
          permitsSkuSharing
          fulfillmentOrdersOptIn
        }
      }
    }
  }
`;

export default async function fetchLocations() {
  const allLocations = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyGraphQL(LOCATIONS_QUERY, { cursor });
    const { nodes, pageInfo } = data.locations;

    allLocations.push(...nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return allLocations;
}