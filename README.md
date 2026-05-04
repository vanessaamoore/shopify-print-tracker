# 🖨️ Shopify Print Tracker

Automatically logs print usage to Google Sheets whenever a new Shopify order comes in.

Each order is parsed for product + color variant → mapped to print name(s) → logged as a row in your sheet.

---

## How It Works

1. A customer places an order on Shopify
2. Shopify sends a webhook to this app
3. The app reads each line item's color variant
4. Looks up the color in your print mapping config
5. Appends a row to your Google Sheet: Date, Order #, Product, Color, Print, Quantity

---

## Setup Guide

### Step 1 — Install dependencies

```bash
npm install
```

---

### Step 2 — Set up Google Cloud (OAuth)

This uses your regular Google login — no service account key file needed.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with your personal Gmail
2. Click **Select a project → New Project**, name it "Print Tracker", click Create
3. Go to **APIs & Services → Enable APIs & Services**
   - Search for "Google Sheets API" and enable it
4. Go to **APIs & Services → OAuth consent screen**
   - Choose **External**, click Create
   - Fill in App name (e.g. "Print Tracker") and your email for support + developer contact
   - Click Save and Continue through the rest (no scopes needed here), then Back to Dashboard
   - Click **Publish App** → Confirm (this just means you can log in yourself)
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: "Print Tracker"
   - Under **Authorized redirect URIs** click Add URI and enter:
     `http://localhost:3000/oauth/callback`
   - Click Create
6. A popup shows your **Client ID** and **Client Secret** — copy both

---

### Step 3 — Create your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new sheet
2. Rename the first tab to: `Print Log`
3. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit`

---

### Step 4 — Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```
SHOPIFY_WEBHOOK_SECRET=paste_shopify_secret_here
GOOGLE_SHEET_ID=paste_sheet_id_here
GOOGLE_CLIENT_ID=paste_client_id_here
GOOGLE_CLIENT_SECRET=paste_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
PORT=3000
```

---

### Step 5 — Configure your print mappings

Open `config/printMappings.js` and add your products and colors:

```js
const PRINT_MAPPINGS = {
  "Your Exact Product Title": {       // Must match Shopify exactly
    "Black":  ["Front Eagle Print", "Back Logo"],  // one color → multiple prints OK
    "White":  ["Clean Chest Logo"],
    "Navy":   ["Nautical Print"],
  },

  "Another Product": {
    "Red":    ["Bold Graphic"],
  },
};
```

**Tips:**
- Product title must match your Shopify product title exactly (case-insensitive is fine)
- Color must match the variant option name in Shopify (case-insensitive)
- One color can map to multiple prints (front + back, etc.)
- If a color isn't mapped yet, the row is still logged with a ⚠️ flag so you know to add it

---

### Step 6 — Authorize with Google (one time only)

```bash
node authorize.js
```

This opens a browser window. Log in with your Google account and click **Allow**.
A token is saved to `config/oauth-token.json` — you never need to do this again.

---

### Step 7 — Initialize the Sheet

Creates the header row in your Google Sheet:

```bash
node setup.js
```

---

### Step 8 — Set up Shopify Webhook

1. In your Shopify admin go to **Settings → Notifications → Webhooks**
2. Click **Create webhook**
   - Event: `Order creation`
   - Format: `JSON`
   - URL: `https://your-server-url.com/webhook/orders-create`
3. Save — copy the **webhook signing secret** that appears

---

### Step 9 — Deploy & Start

See **Hosting Options** below for where to run this. Once deployed:

```bash
npm start
```

---

## Hosting Options

The server needs a public URL so Shopify can reach it.

| Option | Cost | Notes |
|--------|------|-------|
| [Railway](https://railway.app) | Free tier | Easiest — connect GitHub repo, auto-deploys |
| [Render](https://render.com) | Free tier | Similar to Railway |
| Your own VPS | ~$5/mo | Full control |

For quick local testing, use [ngrok](https://ngrok.com):
```bash
ngrok http 3000
# Use the https URL it gives you as your Shopify webhook URL
```

**Note on OAuth + hosting:** The `node authorize.js` step must be run locally (it opens a browser). Once `config/oauth-token.json` is created, upload it to your server — or add its contents as an environment variable. The token auto-refreshes so you won't need to redo this.

---

## Google Sheet Output

Your `Print Log` tab will look like:

| Date | Order # | Product | Color | Print Name | Quantity | Status |
|------|---------|---------|-------|------------|----------|--------|
| 5/4/2026 10:32 AM | #1042 | Classic Crewneck Sweatshirt | Black | Vintage Eagle Front | 2 | ✅ |
| 5/4/2026 10:32 AM | #1042 | Classic Crewneck Sweatshirt | Black | Logo Back | 2 | ✅ |
| 5/4/2026 11:15 AM | #1043 | Hoodie | Grey | Retro Wave Front | 1 | ✅ |

---

## Troubleshooting

**"No color found" warning** — The app looks for color as the first part of the variant title (e.g. "Black / Large"). If your store has a different order (e.g. "Large / Black"), edit `extractColor` in `src/orderProcessor.js` to use `parts[1]` instead of `parts[0]`.

**Unmapped product/color** — Rows with ⚠️ status mean you need to add that product+color to `config/printMappings.js`.

**Webhook not firing** — Make sure your server is publicly accessible and the URL in Shopify matches exactly.

**Token expired** — If the app stops writing to Sheets after a long time, re-run `node authorize.js` locally and re-upload the token file.
