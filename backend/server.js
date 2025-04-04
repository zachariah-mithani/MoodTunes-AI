const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Get Spotify access token
async function getSpotifyToken() {
    const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
            },
        }
    );
    return response.data.access_token;
}

// Analyze mood with Hugging Face
async function analyzeMood(text) {
    const response = await axios.post(
        'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english',
        { inputs: text },
        { headers: { Authorization: `Bearer ${process.env.HF_API_TOKEN}` } }
    );
    const sentiment = response.data[0][0].label === 'POSITIVE' ? 'happy' : 'sad'; // Simplified
    return sentiment;
}

// Map mood to Spotify query
const moodToQuery = {
    happy: 'happy upbeat',
    sad: 'sad acoustic',
    chill: 'chill relax',
};

app.post('/generate-playlist', async (req, res) => {
    try {
        const { moodText } = req.body;
        const mood = await analyzeMood(moodText);
        const token = await getSpotifyToken();

        const query = moodToQuery[mood] || 'pop';
        const tracks = await axios.get(
            `https://api.spotify.com/v1/search?q=${query}&type=track&limit=10`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const playlist = tracks.data.tracks.items.map(track => ({
            name: track.name,
            artist: track.artists[0].name,
            preview_url: track.preview_url,
        }));

        res.json({ mood, playlist });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));
