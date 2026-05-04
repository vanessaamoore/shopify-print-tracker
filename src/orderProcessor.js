const { getPrintsForVariant } = require("../config/printMappings");
const { appendPrintRows } = require("./sheetsLogger");

/**
 * Processes a Shopify order webhook payload.
 * Extracts line items, finds color variants, maps to prints,
 * and logs each to Google Sheets.
 */
async function processOrder(order) {
  const orderNumber = order.name || order.order_number;
  const orderDate = new Date(order.created_at).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });

  console.log(`\n📦 Processing order ${orderNumber}`);

  const rows = [];

  for (const item of order.line_items) {
    const productTitle = item.title;
    const quantity = item.quantity;

    // Find the Color option from variant options
    const variantOptions = item.variant_title
      ? item.variant_title.split(" / ")
      : [];

    // Get full variant properties to find color
    const color = extractColor(item);

    if (!color) {
      console.warn(`  ⚠️  No color found for: ${productTitle} — skipping`);
      rows.push([
        orderDate,
        orderNumber,
        productTitle,
        "Unknown",
        "No color variant found",
        quantity,
        "⚠️ Check mapping",
      ]);
      continue;
    }

    const prints = getPrintsForVariant(productTitle, color);

    if (!prints) {
      console.warn(`  ⚠️  No print mapping for: ${productTitle} / ${color}`);
      rows.push([
        orderDate,
        orderNumber,
        productTitle,
        color,
        "UNMAPPED — add to printMappings.js",
        quantity,
        "⚠️ Needs mapping",
      ]);
      continue;
    }

    for (const print of prints) {
      console.log(`  ✅ ${productTitle} | ${color} → ${print} (qty: ${quantity})`);
      rows.push([orderDate, orderNumber, productTitle, color, print, quantity, "✅"]);
    }
  }

  if (rows.length > 0) {
    await appendPrintRows(rows);
    console.log(`✅ Logged ${rows.length} row(s) for order ${orderNumber}`);
  }
}

/**
 * Extracts the color from a Shopify line item.
 * Checks variant_title and properties for a "Color" field.
 */
function extractColor(item) {
  // Try properties first (e.g. custom line item properties)
  if (item.properties) {
    const colorProp = item.properties.find(
      (p) => p.name.toLowerCase() === "color"
    );
    if (colorProp) return colorProp.value;
  }

  // Try variant_title (e.g. "Black / Large" → "Black")
  if (item.variant_title) {
    const parts = item.variant_title.split(" / ");
    // Return the first part — adjust index if color is not first in your store
    return parts[0] || null;
  }

  return null;
}

module.exports = { processOrder };
