/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'export',
	// distDir: 'out',
	images: {
		unoptimized: true,
	},
	env: {
		// Pass environment variables to the client side
		NEXT_PUBLIC_SPOTIFY_CLIENT_ID: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
		NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET,
	}
}

module.exports = nextConfig 