import axios from 'axios';

const LAMBDA_BASE_URL = 'https://6bvfh7nkvf6bkfshv7hurbyn5y0xdktl.lambda-url.us-east-2.on.aws';

/**
 * Get track data from Spotify API for multiple track IDs
 * @param {Array} trackIds - Array of Spotify track IDs
 * @returns {Object} Object with track IDs as keys and popularity scores as values
 */
export const getTracksPopularity = async (trackIds) => {
	try {

		const secretKey = process.env.NEXT_PUBLIC_LAMBDA_SECRET_KEY;
		const response = await axios({
			method: 'get',
			url: `${LAMBDA_BASE_URL}/getTracks?ids=${trackIds.join(',')}&secretKey=${secretKey}`
		})


		return response.data;
	} catch (error) {
		console.error('Error fetching track popularity from Spotify:', error);
		return {};
	}
};

/**
 * Create a Spotify playlist with the given tracks
 * @param {string} name - Name of the playlist
 * @param {string} description - Description of the playlist
 * @param {Array} trackIds - Array of Spotify track IDs to add to the playlist
 * @returns {Object} Object with playlist info including id and url
 */
export const createPlaylist = async (name, description, trackIds) => {
	try {
		const secretKey = process.env.NEXT_PUBLIC_LAMBDA_SECRET_KEY;
		const response = await axios({
			method: 'post',
			url: `${LAMBDA_BASE_URL}/createPlaylistWithTracks?secretKey=${secretKey}`,
			data: {
				name,
				description,
				ids: trackIds
			},
			headers: {
				'Content-Type': 'application/json'
			}
		});

		return response.data;
	} catch (error) {
		console.error('Error creating Spotify playlist:', error);
		throw error;
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