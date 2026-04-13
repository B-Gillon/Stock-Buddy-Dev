// /src/lib/sync/processLocations.js

export default function processLocations(rawLocations, tenantId) {
  return rawLocations.map((location) => {
    const shopifyId = location.id.replace("gid://shopify/Location/", "");
    const fs = location.fulfillmentService ?? null;

    return {
      tenant_id: tenantId,
      shopify_location_id: parseInt(shopifyId, 10),
      name: location.name ?? null,
      active: location.isActive ?? false,
      location_type: location.isLegacy ? "legacy" : "standard",
      address1: location.address?.address1 ?? null,
      address2: location.address?.address2 ?? null,
      city: location.address?.city ?? null,
      province: location.address?.province ?? null,
      country: location.address?.country ?? null,
      zip: location.address?.zip ?? null,

      // Fulfillment service metadata
      connected_to: fs?.serviceName ?? "Not Connected",
      inventory_controlled_by: fs?.inventoryManagement ? fs.serviceName : "Shopify",
      provides_tracking: fs
        ? fs.trackingSupport ? "Yes" : "No"
        : "N/A",
      orders_api_type: fs
        ? fs.fulfillmentOrdersOptIn ? "Fulfillment Orders" : "Legacy"
        : "N/A",
    };
  });
}
