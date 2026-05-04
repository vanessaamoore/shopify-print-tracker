/**
 * Run this once to authorize the app with your Google account.
 * It will open a browser window, you log in, click Allow,
 * and the token gets saved automatically. You never need to do this again
 * unless you revoke access or delete the token file.
 *
 * Usage: node authorize.js
 */

require("dotenv").config();
const { google } = require("googleapis");
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "config/oauth-token.json");
const REDIRECT_URI = "http://localhost:3000/oauth/callback";

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/spreadsheets"],
  prompt: "consent", // ensures we get a refresh token
});

console.log("\n🔐 Opening Google authorization page...");
console.log("\nIf it doesn't open automatically, paste this URL into your browser:\n");
console.log(authUrl);
console.log("\nWaiting for you to authorize...\n");

// Try to open the browser automatically
try {
  const open = require("open");
  open(authUrl);
} catch {
  // open package may not be installed, that's fine
}

// Start a temporary local server to catch the OAuth callback
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname !== "/oauth/callback") {
    res.end("Not found");
    return;
  }

  const code = parsedUrl.query.code;

  if (!code) {
    res.end("❌ Authorization failed — no code received.");
    server.close();
    return;
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

    res.end(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>✅ Authorization successful!</h2>
        <p>You can close this tab and go back to your terminal.</p>
      </body></html>
    `);

    console.log("✅ Token saved to config/oauth-token.json");
    console.log("You can now start the server with: npm start\n");

    server.close();
  } catch (err) {
    res.end("❌ Error getting token: " + err.message);
    console.error("Token error:", err);
    server.close();
  }
});

server.listen(3000, () => {
  // Server ready, waiting for callback
});
