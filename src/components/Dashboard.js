import React, { useState, useEffect } from 'react';
import { CircularProgress, Box, FormControl, Select, MenuItem, InputLabel, Typography } from '@mui/material';
import { loadAllData, calculateAllSuperlatives } from '../utils/dataProcessor';
import DashboardContent from './DashboardContent';

const Dashboard = () => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [superlatives, setSuperlatives] = useState(null);
	const [data, setData] = useState(null);
	const [season, setSeason] = useState('season1');
	const [availableSeasons] = useState(['season1']);
	const [tabValue, setTabValue] = useState(0);

	useEffect(() => {
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
	}, [season]);

	const handleSeasonChange = (event) => {
		setSeason(event.target.value);
	};

	const handleTabChange = (event, newValue) => {
		setTabValue(newValue);
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
				<CircularProgress />
				<Typography variant="h6" sx={{ ml: 2 }}>Loading Music League data...</Typography>
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

	// Season selector component
	const seasonSelector = (
		<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 4 }}>
			<FormControl sx={{ minWidth: 150, mr: 2 }}>
				<InputLabel id="season-select-label">Season</InputLabel>
				<Select
					labelId="season-select-label"
					id="season-select"
					value={season}
					label="Season"
					onChange={handleSeasonChange}
				>
					{availableSeasons.map((seasonOption) => (
						<MenuItem key={seasonOption} value={seasonOption}>
							{seasonOption === 'season1' ? 'Season 1' : seasonOption}
						</MenuItem>
					))}
				</Select>
			</FormControl>
		</Box>
	);

	return (
		<DashboardContent
			data={data}
			superlatives={superlatives}
			season={season}
			tabValue={tabValue}
			onTabChange={handleTabChange}
			title="Suit & Tie Music League Wrapped"
			subtitle="Insights and Awards from Music League"
			headerContent={seasonSelector}
		/>
	);
};

export default Dashboard;