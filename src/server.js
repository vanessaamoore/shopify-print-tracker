const express = require("express");
const crypto = require("crypto");
const { processOrder } = require("./orderProcessor");

const app = express();

// Raw body needed for HMAC verification
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

function verifyShopifyWebhook(req) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  if (!hmac) return false;
  const hash = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac));
}

app.post("/webhook/orders-create", async (req, res) => {
  if (!verifyShopifyWebhook(req)) {
    console.warn("❌ Invalid webhook signature");
    return res.status(401).send("Unauthorized");
  }

  res.status(200).send("OK"); // Respond immediately to Shopify

  try {
    await processOrder(req.body);
  } catch (err) {
    console.error("Error processing order:", err);
  }
});

app.get("/health", (req, res) => res.send("Print Tracker running ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Print Tracker listening on port ${PORT}`));
