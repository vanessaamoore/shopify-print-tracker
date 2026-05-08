const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "../config/oauth-token.json");

let sheetsClient = null;

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth/callback"
  );
}

function getToken() {
  if (process.env.GOOGLE_OAUTH_TOKEN) {
    try {
      return JSON.parse(process.env.GOOGLE_OAUTH_TOKEN);
    } catch (e) {
      console.error("Failed to parse GOOGLE_OAUTH_TOKEN:", e.message);
      console.error("Token value starts with:", process.env.GOOGLE_OAUTH_TOKEN.substring(0, 50));
    }
  } else {
    console.error("GOOGLE_OAUTH_TOKEN environment variable is not set");
  }
  if (fs.existsSync(TOKEN_PATH)) {
    return JSON.parse(fs.readFileSync(TOKEN_PATH));
  }
  throw new Error(
    "Not authorized yet. Run: node authorize.js — then follow the link to log in with Google."
  );
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const oAuth2Client = getOAuthClient();
  const token = getToken();
  oAuth2Client.setCredentials(token);

  oAuth2Client.on("tokens", (tokens) => {
    if (!process.env.GOOGLE_OAUTH_TOKEN && fs.existsSync(TOKEN_PATH)) {
      const updated = { ...token, ...tokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated));
    }
  });

  sheetsClient = google.sheets({ version: "v4", auth: oAuth2Client });
  return sheetsClient;
}

async function appendPrintRows(rows) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID not set in .env");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Print Log!A:G",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

async function initializeSheet() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Print Log!A1:G1",
  });

  if (existing.data.values && existing.data.values.length > 0) {
    console.log("Sheet already initialized.");
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Print Log!A1:G1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Date", "Order #", "Product", "Color", "Print Name", "Quantity", "Status"]],
    },
  });

  const sheetId = await getSheetId(sheets, spreadsheetId, "Print Log");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
      ],
    },
  });

  console.log("✅ Sheet initialized with headers.");
}

async function getSheetId(sheets, spreadsheetId, sheetName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets.find(
    (s) => s.properties.title === sheetName
  );
  return sheet ? sheet.properties.sheetId : 0;
}

module.exports = { appendPrintRows, initializeSheet };