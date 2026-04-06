import { shopifyGraphQL } from "./shopifyHelpers";

export default async function fetchProducts() {
  const query = `
    query FetchProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            title
            handle
            status
            vendor
            productType
            bodyHtml
            tags

            featuredImage { url }

            options { name }

            productCategory {
              productTaxonomyNode {
                fullName
              }
            }

            collections(first: 50) {
              edges { node { id title } }
            }

            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  sku
                  barcode
                  price
                  compareAtPrice
                  taxable
                  inventoryPolicy
                  image { url }
                  inventoryItem { id unitCost { amount } }
                  selectedOptions { name value }
                }
              }
            }
          }
        }
      }
    }
  `;

  const all = [];
  let after = null;
  let hasNext = true;

  while (hasNext) {
    const data = await shopifyGraphQL(query, { first: 100, after });
    const edges = data.products.edges || [];

    edges.forEach((e) => all.push(e.node));

    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }

  return all;
}