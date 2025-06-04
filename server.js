const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));

let accessToken = null;

// Get Zoom access token
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

    console.log('Access Token:', res.data.access_token);
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

// Start server
app.listen(PORT, () => {
  console.log(`Zoom Dashboard running on port ${PORT}`);
});