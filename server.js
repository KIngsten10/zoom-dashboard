const fs = require('fs');
const https = require('https');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = 3000;

// Load SSL cert and key
const options = {
  key: fs.readFileSync('./certs/key.pem'),
  cert: fs.readFileSync('./certs/cert.pem'),
};

app.set('view engine', 'ejs');
app.use(express.static('public'));

let accessToken = null;

// Function to get Zoom access token (server-to-server)
async function getAccessToken() {
  try {
    const res = await axios.post('https://zoom.us/oauth/token', null, {
      params: {
        grant_type: 'account_credentials',
        account_id: process.env.ZOOM_ACCOUNT_ID,
      },
      auth: {
        username: process.env.ZOOM_CLIENT_ID,
        password: process.env.ZOOM_CLIENT_SECRET,
      },
    });

    console.log('Access Token:', res.data.access_token); // Log token
    return res.data.access_token;
  } catch (err) {
    console.error('Error getting token:', err.response?.data || err.message);
    throw err;
  }
}

// Fetch upcoming meetings
async function getMeetings() {
  try {
    const token = await getAccessToken();
    const res = await axios.get('https://api.zoom.us/v2/users/me/meetings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.meetings;
  } catch (err) {
    console.error('Error fetching meetings:', err.response?.data || err.message);
    throw err;
  }
}

// Route to dashboard
app.get('/', async (req, res) => {
  try {
    const meetings = await getMeetings();
    res.render('dashboard', { meetings });
  } catch (error) {
    res.status(500).send('Error fetching meetings');
  }
});

// Start HTTPS server
https.createServer(options, app).listen(port, () => {
  console.log(`Zoom Dashboard running at https://localhost:${port}`);
});