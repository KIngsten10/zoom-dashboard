require('dotenv').config();
const pool = require('./db'); // DB connection file we’ll create next
const { encrypt } = require('./cryptoUtil');

async function storeSecrets() {
  const userId = 1; // Kingsten's user ID

  const encryptedClientId = encrypt(process.env.ZOOM_CLIENT_ID);
  const encryptedClientSecret = encrypt(process.env.ZOOM_CLIENT_SECRET);
  const encryptedAccountId = encrypt(process.env.ZOOM_ACCOUNT_ID);

  const insertQuery = `
    INSERT INTO zoom_secrets (user_id, client_id, client_secret, account_id)
    VALUES (?, ?, ?, ?)
  `;

  try {
    await pool.execute(insertQuery, [
      userId,
      encryptedClientId,
      encryptedClientSecret,
      encryptedAccountId,
    ]);
    console.log("✅ Encrypted Zoom secrets inserted successfully.");
  } catch (err) {
    console.error("❌ Error inserting Zoom secrets:", err);
  }
}

storeSecrets();
