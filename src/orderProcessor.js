const { appendPrintRows, getSkipList, getPrintReference } = require("./sheetsLogger");

async function processOrder(order) {
  const orderNumber = order.name || order.order_number;
  const orderDate = new Date(order.created_at).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });

  console.log(`\n📦 Processing order ${orderNumber}`);

  const skipList = await getSkipList();
  const printReference = await getPrintReference();
  const rows = [];

  for (const item of order.line_items) {
    const rawTitle = item.title;
    const quantity = item.quantity;

    // Strip Mariposa or Origins prefix from title
    const productTitle = rawTitle.replace(/^(Mariposa|Origins)\s+/i, "").trim();

    // Check if this product should be skipped
    const shouldSkip = skipList.some(
      (title) => title.toLowerCase() === rawTitle.toLowerCase() ||
                 title.toLowerCase() === productTitle.toLowerCase()
    );
    if (shouldSkip) {
      console.log(`  ⏭️  Skipping plain item: ${rawTitle}`);
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
        orderDate, orderNumber, productTitle, "Unknown",
        "No color variant found", quantity, "⚠️ Check mapping", "", productType,
      ]);
      continue;
    }

    // Look up in Print Reference sheet
    const ref = printReference.find(
      (r) => r.productTitle.toLowerCase() === productTitle.toLowerCase()
    );

    if (!ref) {
      console.warn(`  ⚠️  No print reference for: ${productTitle}`);
      rows.push([
        orderDate, orderNumber, productTitle, color,
        "UNMAPPED — add to Print Reference sheet", quantity,
        "⚠️ Needs mapping", customSpecs, productType,
      ]);
      continue;
    }

    // Resolve prints based on how they are determined
    const resolvedPrints = resolvePrints(ref, customSpecs, color);

    if (!resolvedPrints || resolvedPrints.length === 0) {
      console.warn(`  ⚠️  Could not resolve prints for: ${productTitle}`);
      rows.push([
        orderDate, orderNumber, productTitle, color,
        "UNRESOLVED — check Customer Spec Key in Print Reference", quantity,
        "⚠️ Check specs", customSpecs, productType,
      ]);
      continue;
    }

    for (const print of resolvedPrints) {
      console.log(`  ✅ ${productTitle} | ${color} → ${print} (qty: ${quantity})`);
      rows.push([orderDate, orderNumber, productTitle, color, print, quantity, "✅", customSpecs, productType]);
    }
  }

  if (rows.length > 0) {
    await appendPrintRows(rows);
    console.log(`✅ Logged ${rows.length} row(s) for order ${orderNumber}`);
  }
}

/**
 * Resolves which prints to use based on the Print Reference row,
 * customer specs, and color.
 */
function resolvePrints(ref, customSpecs, color) {
  const prints = [];

  // Parse the Customer Spec Key to build a lookup map
  // Format: "BACK PRINT: WHITE → IPOYW\nBACK PRINT: PINK → IPOYP"
  const specMap = parseSpecKey(ref.customerSpecKey);

  // Resolve each print slot (Print 1, Print 2, Print 3)
  for (const printValue of [ref.print1, ref.print2, ref.print3]) {
    if (!printValue || printValue === "") continue;

    if (printValue.toLowerCase() === "dynamic") {
      // Look up in customer specs
      const resolved = resolveFromSpecs(customSpecs, specMap);
      if (resolved) {
        if (Array.isArray(resolved)) {
          prints.push(...resolved);
        } else {
          prints.push(resolved);
        }
      }
    } else if (printValue.toLowerCase().includes("dynamic")) {
      // e.g. "dynamic (arm)" or "dynamic (front)" — resolve from specs
      const resolved = resolveFromSpecs(customSpecs, specMap, printValue);
      if (resolved) prints.push(resolved);
    } else {
      // Fixed print — use as-is
      prints.push(printValue);
    }
  }

  return prints;
}

/**
 * Parses the Customer Spec Key column into a lookup map.
 * e.g. "BACK PRINT: WHITE → IPOYW\nBACK PRINT: PINK → IPOYP"
 * becomes { "BACK PRINT: WHITE": "IPOYW", "BACK PRINT: PINK": "IPOYP" }
 */
function parseSpecKey(customerSpecKey) {
  const map = {};
  if (!customerSpecKey) return map;

  const lines = customerSpecKey.split("\n");
  for (const line of lines) {
    const parts = line.split("→");
    if (parts.length === 2) {
      const key = parts[0].trim().toUpperCase();
      const value = parts[1].trim();
      // Handle paired prints like "HLGG + HLGFPG"
      if (value.includes("+")) {
        map[key] = value.split("+").map(v => v.trim());
      } else {
        map[key] = value;
      }
    }
  }
  return map;
}

/**
 * Resolves a dynamic print by matching customer specs against the spec map.
 */
function resolveFromSpecs(customSpecs, specMap, hint = "") {
  if (!customSpecs) return null;

  // Try each line of the customer specs
  const specLines = customSpecs.split("•").map(s => s.trim().toUpperCase());

  for (const specLine of specLines) {
    // Try direct match first
    if (specMap[specLine]) return specMap[specLine];

    // Try partial match — spec line starts with a known key prefix
    for (const key of Object.keys(specMap)) {
      if (specLine.startsWith(key) || key.startsWith(specLine.split(":")[0])) {
        return specMap[key];
      }
    }
  }

  return null;
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
    if (parts[0] && !/^\d+X?L?S?$/i.test(parts[0].trim())) {
      return parts[0].trim();
    }
  }

  return "No Color";
}

  if (item.variant_title) {
    const parts = item.variant_title.split(" / ");
    return parts[0] || null;
  }

  return null;
}

module.exports = { processOrder };