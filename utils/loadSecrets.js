const db = require('./db');
const { decrypt } = require('./cryptoUtil');

async function getZoomSecretsForUser(userId) {
  const [rows] = await db.query(
    'SELECT client_id, client_secret, account_id FROM zoom_secrets WHERE user_id = ? LIMIT 1',
    [userId]
  );

  if (rows.length === 0) throw new Error('No secrets found for user.');

  return {
    ZOOM_CLIENT_ID: decrypt(rows[0].client_id),
    ZOOM_CLIENT_SECRET: decrypt(rows[0].client_secret),
    ZOOM_ACCOUNT_ID: decrypt(rows[0].account_id)
  };
}

module.exports = getZoomSecretsForUser;
