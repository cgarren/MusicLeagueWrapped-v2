import React, { useState, useEffect } from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';
import { loadAllData, calculateAllSuperlatives, getAvailableSeasons } from '../utils/dataProcessor';
import DashboardContent from './DashboardContent';
import SeasonSelector from './SeasonSelector';

const Dashboard = () => {
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
				const seasons = await getAvailableSeasons();
				setAvailableSeasons(seasons);

				// Set default season to the first available season
				if (seasons.length > 0) {
					setSeason(seasons[0].id);
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
	}, []);

	// Load data when season changes (but only after seasons are loaded)
	useEffect(() => {
		if (!seasonsLoaded) return;

		const fetchData = async () => {
			try {
				setLoading(true);
				const fetchedData = await loadAllData(season);
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
	}, [season, seasonsLoaded]);

	const handleSeasonChange = (newSeason) => {
		setSeason(newSeason);
	};

	const handleTabChange = (event, newValue) => {
		setTabValue(newValue);
	};

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

	// Get current season info for title
	const currentSeasonInfo = availableSeasons.find(s => s.id === season);
	const seasonTitle = currentSeasonInfo ? currentSeasonInfo.label : 'Season';

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
			title={`Suit & Tie Music League Wrapped - ${seasonTitle}`}
			subtitle="Insights and Awards from Music League"
			headerContent={seasonSelector}
		/>
	);
};

export default Dashboard;