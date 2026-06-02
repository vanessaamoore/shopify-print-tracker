const { getPrintsForVariant } = require("../config/printMappings");
const { appendPrintRows, getSkipList } = require("./sheetsLogger");

async function processOrder(order) {
  const orderNumber = order.name || order.order_number;
  const orderDate = new Date(order.created_at).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });

  console.log(`\n📦 Processing order ${orderNumber}`);

  const skipList = await getSkipList();
  const rows = [];

  for (const item of order.line_items) {
    const productTitle = item.title;
    const quantity = item.quantity;

    // Check if this product should be skipped
    const shouldSkip = skipList.some(
      (title) => title.toLowerCase() === productTitle.toLowerCase()
    );
    if (shouldSkip) {
      console.log(`  ⏭️  Skipping plain item: ${productTitle}`);
      continue;
    }

    const color = extractColor(item);

    const productType = /baby tee/i.test(productTitle) ? "Baby Tee" :
      /tee|t-shirt/i.test(productTitle) ? "Tee" :
      /hoodie/i.test(productTitle) ? "Hoodie" :
      /sweatpant/i.test(productTitle) ? "Sweatpant" :
      /short/i.test(productTitle) ? "Short" :
      /tank/i.test(productTitle) ? "Tank" :
      /tote/i.test(productTitle) ? "Tote" : "Crew";

    const customSpecs = item.properties && item.properties.length > 0
      ? item.properties.map(p => `${p.name}: ${p.value}`).join(" • ")
      : "";

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
        "",
        productType,
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
        customSpecs,
        productType,
      ]);
      continue;
    }

    for (const print of prints) {
      console.log(`  ✅ ${productTitle} | ${color} → ${print} (qty: ${quantity})`);
      rows.push([orderDate, orderNumber, productTitle, color, print, quantity, "✅", customSpecs, productType]);
    }
  }

  if (rows.length > 0) {
    await appendPrintRows(rows);
    console.log(`✅ Logged ${rows.length} row(s) for order ${orderNumber}`);
  }
}

function extractColor(item) {
  if (item.properties) {
    const colorProp = item.properties.find(
      (p) => p.name.toLowerCase() === "color"
    );
    if (colorProp) return colorProp.value;
  }

  if (item.variant_title) {
    const parts = item.variant_title.split(" / ");
    return parts[0] || null;
  }

  return null;
}

module.exports = { processOrder };