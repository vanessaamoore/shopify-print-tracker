/**
 * PRINT MAPPING CONFIGURATION
 * ============================
 * Define which print(s) are used for each product + color combination.
 *
 * Structure:
 *   "Product Title" (must match exactly in Shopify): {
 *     "Color Name" (must match Shopify variant option exactly): ["Print Name", ...]
 *   }
 *
 * A single color can map to MULTIPLE prints (e.g. front + back print).
 * Color matching is case-insensitive.
 *
 * Example below — replace with your actual products, colors, and print names.
 */

const PRINT_MAPPINGS = {
  "Classic Crewneck Sweatshirt": {
    "Black":  ["Vintage Eagle Front", "Logo Back"],
    "White":  ["Floral Front"],
    "Navy":   ["Stripe Chest Print"],
    "Red":    ["Bold Logo Front", "Number Back"],
    "Forest Green": ["Nature Scene Front"],
  },

  "Hoodie": {
    "Black":  ["Dark City Print"],
    "White":  ["Minimalist Logo"],
    "Grey":   ["Retro Wave Front"],
  },

  // Add more products below...
  // "Your Product Name": {
  //   "Color": ["Print Name"],
  // },
};

/**
 * Look up prints for a given product + color.
 * Returns an array of print names, or null if no mapping found.
 */
function getPrintsForVariant(productTitle, color) {
  const productKey = Object.keys(PRINT_MAPPINGS).find(
    (k) => k.toLowerCase() === productTitle.toLowerCase()
  );
  if (!productKey) return null;

  const colorKey = Object.keys(PRINT_MAPPINGS[productKey]).find(
    (k) => k.toLowerCase() === color.toLowerCase()
  );
  if (!colorKey) return null;

  return PRINT_MAPPINGS[productKey][colorKey];
}

module.exports = { getPrintsForVariant };
