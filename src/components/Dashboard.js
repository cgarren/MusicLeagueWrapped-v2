import React, { useState, useEffect } from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';
import { loadAllData, calculateAllSuperlatives, getAvailableSeasons } from '../utils/dataProcessor';
import DashboardContent from './DashboardContent';
import SeasonSelector from './SeasonSelector';

const Dashboard = ({ league = 'suit-and-tie', initialSeason = 'season1' }) => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [superlatives, setSuperlatives] = useState(null);
	const [data, setData] = useState(null);
	const [season, setSeason] = useState('season1');
	const [availableSeasons, setAvailableSeasons] = useState([]);
	const [tabValue, setTabValue] = useState(0);
	const [seasonsLoaded, setSeasonsLoaded] = useState(false);

	// Load available seasons on component mount
	useEffect(() => {
		const loadSeasons = async () => {
			try {
				const seasons = await getAvailableSeasons(league);
				setAvailableSeasons(seasons);

				// Set season from URL if valid, otherwise first available
				if (seasons.length > 0) {
					const hasInitial = seasons.some(s => s.id === initialSeason);
					setSeason(hasInitial ? initialSeason : seasons[0].id);
				}
				setSeasonsLoaded(true);
			} catch (err) {
				console.error('Error loading seasons:', err);
				// Fallback to season1
				setAvailableSeasons([{ id: 'season1', label: 'Season 1', number: 1 }]);
				setSeason('season1');
				setSeasonsLoaded(true);
			}
		};

		loadSeasons();
	}, [league, initialSeason]);

	// Load data when season changes (but only after seasons are loaded)
	useEffect(() => {
		if (!seasonsLoaded) return;

		const fetchData = async () => {
			try {
				setLoading(true);
				const fetchedData = await loadAllData(season, league);
				setData(fetchedData);
				const calculatedSuperlatives = calculateAllSuperlatives(fetchedData);
				setSuperlatives(calculatedSuperlatives);
				setLoading(false);
			} catch (err) {
				console.error('Error fetching or processing data:', err);
				setError('Failed to load data. Please try again later.');
				setLoading(false);
			}
		};

		fetchData();
	}, [season, seasonsLoaded, league]);

	const handleSeasonChange = (newSeason) => {
		setSeason(newSeason);
		// Update URL to reflect selected season on dedicated league pages
		if (typeof window !== 'undefined' && league) {
			const newPath = `/${league}/${newSeason}`;
			window.history.pushState({}, '', newPath);
		}
	};

	const handleTabChange = (event, newValue) => {
		setTabValue(newValue);
	};

	// Sync season with browser navigation (back/forward)
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const onPopState = () => {
			const path = window.location.pathname || '/';
			const segments = path.split('/').filter(Boolean);
			// Expecting /<league>/<seasonN>
			const seasonSeg = segments[1];
			if (seasonSeg && /^season\d+$/.test(seasonSeg)) {
				if (seasonSeg !== season) {
					setSeason(seasonSeg);
				}
			}
		};

		window.addEventListener('popstate', onPopState);
		return () => window.removeEventListener('popstate', onPopState);
	}, [season]);

	if (!seasonsLoaded || loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
				<CircularProgress />
				<Typography variant="h6" sx={{ ml: 2 }}>
					{!seasonsLoaded ? 'Loading available seasons...' : 'Loading Music League data...'}
				</Typography>
			</Box>
		);
	}

	if (error) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
				<Typography variant="h6" color="error">{error}</Typography>
			</Box>
		);
	}

	if (!data || !superlatives) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
				<Typography variant="h6" color="error">No data available</Typography>
			</Box>
		);
	}

	// Title no longer includes season

	// Get league display name
	const getLeagueDisplayName = (leagueId) => {
		switch (leagueId) {
			case 'suit-and-tie':
				return 'Suit & Tie';
			case 'amherst':
				return 'Amherst';
			case 'harvard-law-music-club':
				return 'Harvard Law Music Club';
			default:
				return leagueId;
		}
	};

	const leagueDisplayName = getLeagueDisplayName(league);

	// Season selector component
	const seasonSelector = availableSeasons.length > 1 ? (
		<SeasonSelector
			seasons={availableSeasons}
			selectedSeason={season}
			onSeasonChange={handleSeasonChange}
		/>
	) : null;

	return (
		<DashboardContent
			data={data}
			superlatives={superlatives}
			season={season}
			tabValue={tabValue}
			onTabChange={handleTabChange}
			title={`${leagueDisplayName} Wrapped`}
			subtitle="Insights and Awards from Music League"
			headerContent={seasonSelector}
		/>
	);
};

export default Dashboard;