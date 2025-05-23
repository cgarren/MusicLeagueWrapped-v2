# Spotify Integration Setup

This application uses the Spotify API to fetch popularity data for tracks submitted in Music League. The popularity data is used to calculate two superlatives:

1. **Crowd Pleaser** - Competitor who submits songs with the highest average Spotify popularity (higher numbers indicate more popular songs)
2. **Trend Setter** - Competitor who submits songs with the lowest average Spotify popularity (lower numbers indicate more obscure songs)

## Setup Instructions

1. Create a Spotify Developer account at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Create a new application in the dashboard
3. Once created, you'll receive a **Client ID** and **Client Secret**
4. Deploy the Lambda function to AWS:
   - Navigate to the `/lambda` folder in this project
   - Follow the deployment instructions or example code provided
   - Configure the Lambda function's environment variables with your Spotify API credentials and a secret key
   - Note the Lambda function URL for the next step
5. Update the Lambda function URL in `src/utils/spotifyApi.js` to match your deployed function
6. Add the following environment variable to the `.env` file (create it if it doesn't exist):

```
# Lambda Function Authentication
NEXT_PUBLIC_LAMBDA_SECRET_KEY=your_lambda_secret_key_here
```

9. Add the environment variable to your `next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_LAMBDA_SECRET_KEY: process.env.NEXT_PUBLIC_LAMBDA_SECRET_KEY,
  },
  // ... other config options
}

module.exports = nextConfig
```

10. Replace `your_lambda_secret_key_here` with the secret key that matches your deployed Lambda function configuration
11. Restart the application if it's already running

## How It Works

1. The application loads submission data from CSV files
2. It extracts Spotify Track IDs from the URIs in the submission data
3. It queries the Spotify API using the "Get Several Tracks" endpoint to fetch popularity data
   - This is done via an AWS Lambda function proxy. The Lambda function is a proxy to the Spotify API and is used to avoid calling the Spotify API directly from the client side with credentials. See the /lambda directory for some example code for this function.
   - The code is set up to call a /getTracks endpoint on the lambda function with the track IDs as a query parameter.
   - The request includes a secret key for basic authentication with the Lambda function.
4. The popularity scores (range 0-100) are used to calculate average popularity for each competitor:
   - Higher scores (closer to 100) indicate more mainstream/popular songs
   - Lower scores (closer to 0) indicate more obscure/niche songs
5. The results are displayed as superlatives on the dashboard:
   - Crowd Pleaser: Highest average popularity
   - Trend Setter: Lowest average popularity

## Troubleshooting

- If you encounter issues with the Spotify API, check that:
  1. The Lambda function is deployed correctly
  2. The `NEXT_PUBLIC_LAMBDA_SECRET_KEY` matches the key expected by your Lambda function
  3. The Lambda function URL in `spotifyApi.js` matches your deployed function's URL
- The application will continue to function without Spotify data, but the popularity-based superlatives will not be displayed
- Spotify API requests are rate-limited. If you encounter rate limiting issues, you may need to implement additional handling in the code
- Only competitors with at least 3 submissions are considered for the popularity-based superlatives

## API Documentation

For more information about the Spotify API endpoints used, refer to:
- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Get Several Tracks Endpoint](https://developer.spotify.com/documentation/web-api/reference/get-several-tracks) 