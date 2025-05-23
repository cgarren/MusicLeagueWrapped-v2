/*
 * Lambda function to get Spotify track popularity
 * Serves as a proxy to the Spotify API
 * Needs to be deployed to AWS Lambda with a public function URL
 * The following environment variables need to be set in the lambda console:
 * - SPOTIFY_CLIENT_ID
 * - SPOTIFY_CLIENT_SECRET
 * - SECRET_KEY
 */

export const handler = async (event) => {
	let body;
	let statusCode = 200;
	let headers = {};

	const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
	const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
	const SECRET_KEY = process.env.SECRET_KEY

	const combo = event && event.requestContext && event.requestContext.http && event.requestContext.http.method && event.requestContext.http.path ? event.requestContext.http.method + " " + event.requestContext.http.path : undefined;

	try {
		if (!event?.queryStringParameters?.secretKey || event?.queryStringParameters?.secretKey != SECRET_KEY) {
			throw new Error('secretKey is incorrect');
		}

		if (combo === "GET /getTracks") {
			if (!event?.queryStringParameters?.ids) {
				throw new Error('No ids provided');
			}
			const spotifyToken = await getSpotifyToken(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET);
			const response = await getTracksPopularity(event.queryStringParameters.ids, spotifyToken);
			body = response;
		}
	} catch (error) {
		statusCode = 400;
		body = error.message;
	} finally {
		if (!typeof body === 'string' && !body instanceof String) {
			body = JSON.stringify(body);
			headers["Content-Type"] = "application/json";
		}
	}

	return {
		statusCode,
		body,
		headers
	};
};

const getSpotifyToken = async (clientId, clientSecret) => {
	try {

		if (!clientId || !clientSecret) {
			throw new Error('Spotify credentials not found');
		}

		const response = await fetch('https://accounts.spotify.com/api/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
			},
			body: 'grant_type=client_credentials'
		})

		if (!response.ok) {
			throw new Error('Failed to get Spotify token');
		}

		const accessToken = await JSON.parse(await response.text()).access_token;
		console.log(accessToken);

		return accessToken;
	} catch (error) {
		console.error('Error getting Spotify token:', error);
		throw error;
	}
};

export const getTracksPopularity = async (trackIds, token) => {
	console.log(trackIds, token);
	if (!trackIds || !token) {
		throw new Error('No trackIds or token provided');
	}

	// Convert trackIds to an array if it's a string
	if (typeof trackIds === 'string') {
		trackIds = trackIds.split(',');
	}

	// Split the trackIds into chunks of 50 (Spotify API limit)
	const chunks = [];
	for (let i = 0; i < trackIds.length; i += 50) {
		chunks.push(trackIds.slice(i, i + 50));
	}

	let allTracksData = {};

	// Process each chunk
	for (const chunk of chunks) {
		const url = `https://api.spotify.com/v1/tracks?ids=${chunk.join(',')}`

		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`
			}
		});

		const tracks = await JSON.parse(await response.text()).tracks;

		// Map tracks to their popularity scores
		tracks.forEach(track => {
			if (track) {
				allTracksData[track.id] = {
					popularity: track.popularity,
					name: track.name,
					artists: track.artists.map(artist => artist.name).join(', ')
				};
			}
		});
	}

	return allTracksData;
};