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

    const productTitle = rawTitle.replace(/^(Mariposa|Origins)\s+/i, "").trim();

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
      console.warn(`  ⚠️  No color found for: ${productTitle}`);
      rows.push([
        orderDate, orderNumber, productTitle, "Unknown",
        "No color variant found", quantity, "⚠️ Check mapping", "", productType,
      ]);
      continue;
    }

    const ref = findReference(printReference, productTitle, color);

    if (!ref) {
      console.warn(`  ⚠️  No print reference for: ${productTitle} / ${color}`);
      rows.push([
        orderDate, orderNumber, productTitle, color,
        "UNMAPPED — add to Print Reference sheet", quantity,
        "⚠️ Needs mapping", customSpecs, productType,
      ]);
      continue;
    }

    const resolvedPrints = resolvePrints(ref, customSpecs);

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

function findReference(printReference, productTitle, color) {
  // First try to match on title + color (supports comma-separated color lists)
  const colorMatch = printReference.find(
    (r) =>
      r.productTitle.toLowerCase() === productTitle.toLowerCase() &&
      r.color &&
      r.color.split(",").map(c => c.trim().toLowerCase()).includes(color.toLowerCase())
  );
  if (colorMatch) return colorMatch;

  // Fall back to title only (for products where color doesn't determine print)
  const titleMatch = printReference.find(
    (r) =>
      r.productTitle.toLowerCase() === productTitle.toLowerCase() &&
      !r.color
  );
  return titleMatch || null;
}

function resolvePrints(ref, customSpecs) {
  const prints = [];
  const specMap = parseSpecKey(ref.customerSpecKey);

  for (const printValue of [ref.print1, ref.print2, ref.print3]) {
    if (!printValue || printValue === "") continue;

    if (printValue.toLowerCase() === "dynamic" || printValue.toLowerCase().includes("dynamic")) {
      const resolved = resolveFromSpecs(customSpecs, specMap);
      if (resolved) {
        if (Array.isArray(resolved)) {
          prints.push(...resolved);
        } else {
          prints.push(resolved);
        }
      }
    } else {
      prints.push(printValue);
    }
  }

  return prints;
}

function parseSpecKey(customerSpecKey) {
  const map = {};
  if (!customerSpecKey) return map;

  const lines = customerSpecKey.split("\n");
  for (const line of lines) {
    const parts = line.split("→");
    if (parts.length === 2) {
      const key = parts[0].trim().toUpperCase();
      const value = parts[1].trim();
      if (value.includes("+")) {
        map[key] = value.split("+").map(v => v.trim());
      } else {
        map[key] = value;
      }
    }
  }
  return map;
}

function resolveFromSpecs(customSpecs, specMap) {
  if (!customSpecs) return null;

  const specLines = customSpecs.split("•").map(s => s.trim().toUpperCase());

  for (const specLine of specLines) {
    if (specMap[specLine]) return specMap[specLine];

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

module.exports = { processOrder };