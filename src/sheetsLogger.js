const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");

const TOKEN_PATH = path.join(__dirname, "../config/oauth-token.json");

let sheetsClient = null;

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth/callback"
  );
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const oAuth2Client = getOAuthClient();

  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(
      "Not authorized yet. Run: node authorize.js  — then follow the link to log in with Google."
    );
  }

  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oAuth2Client.setCredentials(token);

  // Auto-refresh if expired
  oAuth2Client.on("tokens", (tokens) => {
    const updated = { ...token, ...tokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated));
  });

  sheetsClient = google.sheets({ version: "v4", auth: oAuth2Client });
  return sheetsClient;
}

/**
 * Appends rows to the Google Sheet.
 * Each row: [Date, Order #, Product, Color, Print Name, Quantity, Status]
 */
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

/**
 * Creates the header row if the sheet is empty.
 * Call this once during setup.
 */
async function initializeSheet() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Check if header exists
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Print Log!A1:G1",
  });

  if (existing.data.values && existing.data.values.length > 0) {
    console.log("Sheet already initialized.");
    return;
  }

  // Write header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Print Log!A1:G1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Date", "Order #", "Product", "Color", "Print Name", "Quantity", "Status"]],
    },
  });

  // Bold the header row
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
