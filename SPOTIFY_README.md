# Spotify Integration Setup

This application uses the Spotify API to fetch popularity data for tracks submitted in Music League. The popularity data is used to calculate two superlatives:

1. **Crowd Pleaser** - Competitor who submits songs with the highest average Spotify popularity
2. **Trend Setter** - Competitor who submits songs with the lowest average Spotify popularity

## Setup Instructions

1. Create a Spotify Developer account at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Create a new application in the dashboard
3. Once created, you'll receive a **Client ID** and **Client Secret**
4. Create a `.env` file in the root directory of this project with the following content:

```
# Spotify API credentials
REACT_APP_SPOTIFY_CLIENT_ID=your_client_id_here
REACT_APP_SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

5. Replace `your_client_id_here` and `your_client_secret_here` with your actual Spotify API credentials
6. Restart the application if it's already running

## How It Works

1. The application loads submission data from CSV files
2. It extracts Spotify Track IDs from the URIs in the submission data
3. It queries the Spotify API using the "Get Several Tracks" endpoint to fetch popularity data
4. The popularity scores (range 0-100) are used to calculate average popularity for each competitor
5. The results are displayed as superlatives on the dashboard

## Troubleshooting

- If you encounter issues with the Spotify API, check that your credentials are correct in the `.env` file
- The application will continue to function without Spotify data, but the popularity-based superlatives will not be displayed
- Spotify API requests are rate-limited. If you encounter rate limiting issues, you may need to implement additional handling in the code

## API Documentation

For more information about the Spotify API endpoints used, refer to:
- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Get Several Tracks Endpoint](https://developer.spotify.com/documentation/web-api/reference/get-several-tracks) 