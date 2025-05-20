import axios from 'axios';

/**
 * Get Spotify access token using Client Credentials flow
 */
const getSpotifyToken = async () => {
	try {
		// Try to get from environment variables first
		let clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || process.env.REACT_APP_SPOTIFY_CLIENT_ID;
		let clientSecret = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET || process.env.REACT_APP_SPOTIFY_CLIENT_SECRET;

		if (!clientId || !clientSecret) {
			throw new Error('Spotify credentials not found in environment variables');
		}

		const response = await axios({
			method: 'post',
			url: 'https://accounts.spotify.com/api/token',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
			},
			data: 'grant_type=client_credentials'
		});

		return response.data.access_token;
	} catch (error) {
		console.error('Error getting Spotify token:', error);
		throw error;
	}
};

/**
 * Get track data from Spotify API for multiple track IDs
 * @param {Array} trackIds - Array of Spotify track IDs
 * @returns {Object} Object with track IDs as keys and popularity scores as values
 */
export const getTracksPopularity = async (trackIds) => {
	try {
		const response = await axios({
			method: 'get',
			url: `https://6bvfh7nkvf6bkfshv7hurbyn5y0xdktl.lambda-url.us-east-2.on.aws/getTracks?ids=${trackIds.join(',')}`
		})


		return response.data;
	} catch (error) {
		console.error('Error fetching track popularity from Spotify:', error);
		return {};
	}
};

/**
 * Extracts Spotify track IDs from Spotify URIs
 * @param {Array} spotifyUris - Array of Spotify URIs (spotify:track:1234567)
 * @returns {Array} Array of track IDs
 */
export const extractTrackIdsFromUris = (spotifyUris) => {
	return spotifyUris.map(uri => {
		// Handle both URI formats:
		// spotify:track:1234567 and https://open.spotify.com/track/1234567
		if (uri.includes('spotify:track:')) {
			return uri.split('spotify:track:')[1];
		} else if (uri.includes('spotify.com/track/')) {
			// Extract the ID from URL format
			const parts = uri.split('/track/');
			if (parts.length > 1) {
				// Remove any query parameters if present
				return parts[1].split('?')[0];
			}
		}
		return uri; // Return as is if format not recognized
	});
}; 