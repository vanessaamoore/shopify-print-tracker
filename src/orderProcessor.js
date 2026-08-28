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
      (title) => title.trim().toLowerCase() === rawTitle.trim().toLowerCase() ||
                 title.trim().toLowerCase() === productTitle.trim().toLowerCase()
    );
    if (shouldSkip) {
      console.log(`  ⏭️  Skipping plain item: ${rawTitle}`);
      continue;
    }

    const color = extractColor(item, productTitle);

    const productType = /baby tee/i.test(productTitle) ? "Baby Tee" :
      /tee|t-shirt/i.test(productTitle) ? "Tee" :
      /hoodie/i.test(productTitle) ? "Hoodie" :
      /sweatpant/i.test(productTitle) ? "Sweatpant" :
      /short/i.test(productTitle) ? "Short" :
      /tank/i.test(productTitle) ? "Tank" :
      /tote/i.test(productTitle) ? "Tote" : "Crew";

    let customSpecs = item.properties && item.properties.length > 0
      ? item.properties.map(p => `${p.name}: ${p.value}`).join(" • ")
      : "";

    // For variants like "Garment Color / Print Color / Size",
    // capture the second part as the print color spec
    if (item.variant_title) {
      const sizeRegex = /^(XS|S|M|L|XL|XXL|2XL|3XL|\d+XL?|one size)$/i;
      const variantParts = item.variant_title.split(" / ").map(p => p.trim());
      const nonSizeParts = variantParts.filter(p => !sizeRegex.test(p));
      if (nonSizeParts.length > 1) {
        const printColorSpec = `FRONT PRINT COLOR: ${nonSizeParts[1].toUpperCase()}`;
        customSpecs = customSpecs ? `${customSpecs} • ${printColorSpec}` : printColorSpec;
      }
    }

    // Check if this is a Safe with Me product (special handling)
    const safeWithMePrints = handleSafeWithMe(productTitle, color);
    let ref = null;
    let resolvedPrints = null;

    if (safeWithMePrints) {
      // Safe with Me products bypass the reference lookup
      resolvedPrints = safeWithMePrints;
      console.log(`  ✅ Safe with Me detected: ${safeWithMePrints.join(", ")}`);
    } else {
      // Normal products use the reference lookup
      ref = findReference(printReference, productTitle, color || "");

      if (!ref && !color) {
        console.warn(`  ⚠️  No color found for: ${productTitle}`);
        rows.push([
          orderDate, orderNumber, productTitle, "Unknown",
          "No color variant found", quantity, "⚠️ Check mapping", "", productType,
        ]);
        continue;
      }

      if (!ref) {
        console.warn(`  ⚠️  No print reference for: ${productTitle} / ${color}`);
        rows.push([
          orderDate, orderNumber, productTitle, color,
          "UNMAPPED — add to Print Reference sheet", quantity,
          "⚠️ Needs mapping", customSpecs, productType,
        ]);
        continue;
      }

      resolvedPrints = resolvePrints(ref, customSpecs);
    }

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
  }

  if (rows.length > 0) {
    await appendPrintRows(rows);
    console.log(`✅ Logged ${rows.length} row(s) for order ${orderNumber}`);
  }
}

function findReference(printReference, productTitle, color) {
  const normalize = (t) => t.toLowerCase().replace(/\s*-\s*/g, "-").trim();

  // Build a version of the title with a trailing "-Color" suffix removed,
  // if that suffix matches the extracted color
  let strippedTitle = productTitle;
  const suffixMatch = productTitle.match(/^(.*?)[-–]\s*([A-Za-z][A-Za-z\s]*)$/);
  if (suffixMatch && color && suffixMatch[2].trim().toLowerCase() === color.toLowerCase()) {
    strippedTitle = suffixMatch[1].trim();
  }

  const candidates = [normalize(productTitle)];
  if (strippedTitle !== productTitle) candidates.push(normalize(strippedTitle));

  // Try title + color match for each candidate title
  for (const cand of candidates) {
    const colorMatch = printReference.find(
      (r) =>
        normalize(r.productTitle) === cand &&
        r.color &&
        r.color.split(",").map(c => c.trim().toLowerCase()).includes(color.toLowerCase())
    );
    if (colorMatch) return colorMatch;
  }

  // Fall back to title-only rows (no color specified)
  for (const cand of candidates) {
    const titleMatch = printReference.find(
      (r) => normalize(r.productTitle) === cand && !r.color
    );
    if (titleMatch) return titleMatch;
  }

  return null;
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

function extractColor(item, productTitle) {
  if (item.properties) {
    const colorProp = item.properties.find(
      (p) => p.name.toLowerCase() === "color"
    );
    if (colorProp) return colorProp.value;
  }

  const sizeRegex = /^(XS|S|M|L|XL|XXL|2XL|3XL|4XL|\d+XL?|one size)$/i;

  if (item.variant_title && item.variant_title !== "Default Title") {
    const parts = item.variant_title.split(" / ").map(p => p.trim());
    const colorPart = parts.find(p => !sizeRegex.test(p));
    if (colorPart) return colorPart;
  }

  // Fallback: pull color from a "- Color" suffix on the product title
  const titleMatch = productTitle.match(/[-–]\s*([A-Za-z][A-Za-z\s]*)$/);
  if (titleMatch) return titleMatch[1].trim();

  return "No Color";
}
function handleSafeWithMe(productTitle, color) {
  // Check if this is a Safe with Me product
  if (!productTitle.toLowerCase().includes("safe with me")) {
    return null; // Not a Safe with Me product
  }

  const prints = [];

  // Extract front print type from product name
  if (productTitle.toLowerCase().includes("social work")) {
    prints.push("SW");
  } else if (productTitle.toLowerCase().includes("nursing")) {
    prints.push("NUR");
  } else if (productTitle.toLowerCase().includes("psych")) {
    prints.push("PSYCH");
  }

  // Add back print only if color is "Safe with Me Print"
  if (color && color.toLowerCase() === "safe with me print") {
    prints.push("SWM");
  }

  return prints.length > 0 ? prints : null;
}
module.exports = { processOrder };
