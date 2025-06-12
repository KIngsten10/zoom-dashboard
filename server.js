const express = require('express');
const { encrypt, decrypt } = require('./utils/cryptoUtil');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const moment = require('moment-timezone');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

let accessToken = null;

app.get('/encrypt-env', (req, res) => {
  const encrypted = {
    ZOOM_CLIENT_ID: encrypt("B1EqDhUSRKPwBUhB7lnJA"),
    ZOOM_CLIENT_SECRET: encrypt("7A0N0j2vkG7niWARYQ4Pj4KbE3m7I5Ed"),
    ZOOM_ACCOUNT_ID: encrypt("Ynl70aidTIiVMOTb0XU1jA")
  };
  res.json(encrypted);
});

const getZoomSecretsForUser = require('./utils/loadSecrets');
let ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID;

(async () => {
  try {
    const secrets = await getZoomSecretsForUser(1); // Assuming user_id = 1 for now
    ZOOM_CLIENT_ID = secrets.ZOOM_CLIENT_ID;
    ZOOM_CLIENT_SECRET = secrets.ZOOM_CLIENT_SECRET;
    ZOOM_ACCOUNT_ID = secrets.ZOOM_ACCOUNT_ID;
    console.log('✅ Zoom secrets loaded from database');
  } catch (err) {
    console.error('❌ Failed to load Zoom secrets:', err.message);
    process.exit(1); // stop app if secrets missing
  }
})();



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
    console.log('🔑 Access token received');
    const res = await axios.get('https://api.zoom.us/v2/users/me/meetings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('📦 Meetings API response:', res.data);
    return res.data.meetings;
  } catch (err) {
    console.error('Error fetching meetings:', err.response?.data || err.message);
    throw err;
  }
}

// Schedule a meeting
async function scheduleMeeting(topic, startTime, duration) {
  try {
    const token = await getAccessToken();
    const meetingData = {
      topic,
      type: 2,
      start_time: startTime,
      duration,
      timezone: 'Asia/Kolkata', // Make sure this is correctly set
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true
      }
    };

    console.log('📦 Payload to Zoom:', JSON.stringify(meetingData, null, 2));

    const res = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      meetingData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return res.data;
  } catch (err) {
    console.error('❌ Zoom API error:', err.response?.data || err.message);
    throw err;
  }
}


// Fetch participants for a past meeting
async function getMeetingParticipants(meetingId) {
  try {
    const token = await getAccessToken();
    const res = await axios.get(`https://api.zoom.us/v2/report/meetings/${meetingId}/participants`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        page_size: 100
      }
    });
    return res.data.participants;
  } catch (err) {
    console.error(`Error fetching participants for meeting ${meetingId}:`, err.response?.data || err.message);
    return [];
  }
}

// Form page to schedule meeting
app.get('/schedule', (req, res) => {
  res.send(`
    <form method="POST" action="/schedule">
      <label>Topic: <input type="text" name="topic" /></label><br/>
      <label>Start Time (UTC): <input type="datetime-local" name="startTime" /></label><br/>
      <label>Duration (mins): <input type="number" name="duration" /></label><br/>
      <button type="submit">Schedule</button>
    </form>
  `);
});

// Route to dashboard
app.get('/', async (req, res) => {
    console.log('📥 GET / - Dashboard route hit');
  try {
    const filter = req.query.filter || 'all';
    console.log('🔍 Selected Filter:', filter);
    let meetings = await getMeetings();
    console.log(`📅 Fetched ${meetings.length} meetings`);

    const now = new Date();

    // Filter logic
    if (filter === 'today') {
      meetings = meetings.filter(meeting => {
        const start = new Date(meeting.start_time);
        return start.toDateString() === now.toDateString();
      });
    } else if (filter === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      meetings = meetings.filter(meeting => {
        const start = new Date(meeting.start_time);
        return start >= startOfWeek && start <= endOfWeek;
      });
    } else if (filter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      meetings = meetings.filter(meeting => {
        const start = new Date(meeting.start_time);
        return start >= startOfMonth && start <= endOfMonth;
      });
    }

    for (let meeting of meetings) {
      if (meeting.status === 'ended') {
        console.log(`👥 Fetching participants for meeting ${meeting.id}`);
        meeting.participants = await getMeetingParticipants(meeting.id);
        console.log(`✅ Got ${meeting.participants.length} participants`);
      } else {
        meeting.participants = [];
      }
    }

    console.log('✅ Rendering dashboard with meetings:', meetings.map(m => m.topic));
    res.render('dashboard', { meetings, selectedFilter: filter });

  } catch (error) {
    console.error(error);
    console.error('❌ Error rendering dashboard:', error.stack || error);
    res.status(500).send('Error fetching meetings');
  }
});


// Handle meeting scheduling
app.post('/schedule', async (req, res) => {
  let { topic, startTime, duration } = req.body;

  // Convert to full ISO string with timezone applied
  const isoStartTime = moment.tz(startTime, 'Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss');

  console.log('➡️ Received from form:', { topic, startTime, duration });
  console.log('⏰ Converted ISO Start Time:', isoStartTime);

  try {
    const result = await scheduleMeeting(topic, isoStartTime, parseInt(duration));
    console.log('✅ Zoom responded with scheduled meeting:', result);
    res.redirect('/');
  } catch (error) {
    console.error('❌ Error scheduling meeting:', error.response?.data || error.message);
    res.status(500).send('Error scheduling meeting');
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Zoom Dashboard running on port ${PORT}`);
});