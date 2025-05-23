/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'export',
	// distDir: 'out',
	images: {
		unoptimized: true,
	},
	env: {
		// Pass environment variables to the client side
		NEXT_PUBLIC_LAMBDA_SECRET_KEY: process.env.NEXT_PUBLIC_LAMBDA_SECRET_KEY
	}
}

module.exports = nextConfig 