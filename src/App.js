import React, { useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import Dashboard from './components/Dashboard';
import UploadDashboard from './components/UploadDashboard';
import Header from './components/Header';
import Footer from './components/Footer';

const theme = createTheme({
	palette: {
		primary: {
			main: '#921cbd', // Purple (was Spotify green)
		},
		secondary: {
			main: '#191414', // Spotify black
		},
		background: {
			default: '#f5f5f5',
		},
	},
	typography: {
		fontFamily: '"Circular", "Helvetica Neue", "Arial", sans-serif',
		h3: {
			fontWeight: 700,
		},
		h5: {
			fontWeight: 600,
		},
	},
});

function App() {
	// Get the current path to determine which component to render
	const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

	// Determine which dashboard to show and which league/season to load
	const getLeagueFromPath = (path) => {
		const segments = (path || '/')
			.split('/')
			.filter(Boolean);
		const first = segments[0] || '';
		// Treat the first non-empty segment as the league, except reserved paths
		if (!first || first === '.well-known') return null;
		return first;
	};

	const getSeasonFromPath = (path) => {
		const segments = (path || '/')
			.split('/')
			.filter(Boolean);
		// Look for a segment like "seasonN"
		const seasonSegment = segments.find((seg) => /^season\d+$/.test(seg));
		return seasonSegment || null;
	};

	const league = getLeagueFromPath(currentPath);
	const isPreloadedData = league !== null;
	const initialSeason = getSeasonFromPath(currentPath) || 'season1';

	// Optional nice-to-have: redirect base league path to /season1 for consistency (avoid doing this during render)
	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (!isPreloadedData) return;
		const segments = currentPath.split('/').filter(Boolean);
		const hasSeason = segments.some((seg) => /^season\d+$/.test(seg));
		if (!hasSeason) {
			const target = `/${league}/season1`;
			if (currentPath !== target) {
				window.history.replaceState({}, '', target);
			}
		}
	}, [currentPath, isPreloadedData, league]);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Box sx={{
				display: 'flex',
				flexDirection: 'column',
				minHeight: '100vh'
			}}>
				<Header />
				<Box component="main" sx={{ flexGrow: 1 }}>
					{isPreloadedData ? <Dashboard league={league} initialSeason={initialSeason} /> : <UploadDashboard />}
				</Box>
				<Footer />
			</Box>
		</ThemeProvider>
	);
}

export default App; 