require("dotenv").config();
const { initializeSheet } = require("./src/sheetsLogger");

console.log("🔧 Initializing Google Sheet...");
initializeSheet()
  .then(() => console.log("Done!"))
  .catch((err) => {
    console.error("Setup failed:", err.message);
    process.exit(1);
  });
