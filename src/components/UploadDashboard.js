import React, { useState } from 'react';
import {
	Container,
	Typography,
	Grid,
	CircularProgress,
	Box,
	Button,
	Alert
} from '@mui/material';
import { calculateAllSuperlatives } from '../utils/dataProcessor';
import { getTracksPopularity, extractTrackIdsFromUris } from '../utils/spotifyApi';

import DashboardContent from './DashboardContent';
import FileUploadZone from './FileUploadZone';

const UploadDashboard = () => {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [superlatives, setSuperlatives] = useState(null);
	const [data, setData] = useState(null);
	const [tabValue, setTabValue] = useState(0);

	// File upload states
	const [uploadedFiles, setUploadedFiles] = useState({
		competitors: null,
		rounds: null,
		submissions: null,
		votes: null
	});
	const [fileNames, setFileNames] = useState({
		competitors: '',
		rounds: '',
		submissions: '',
		votes: ''
	});

	const handleFileUpload = (fileData, fileName, fileType) => {
		setUploadedFiles(prev => ({
			...prev,
			[fileType]: fileData
		}));
		setFileNames(prev => ({
			...prev,
			[fileType]: fileName
		}));
	};

	const processData = async () => {
		const { competitors, rounds, submissions, votes } = uploadedFiles;

		if (!competitors || !rounds || !submissions || !votes) {
			setError('Please upload all four CSV files before processing.');
			return;
		}

		try {
			setLoading(true);
			setError(null);

			// Extract all Spotify URIs from submissions
			const spotifyUris = submissions.map(submission => submission['Spotify URI']);

			// Extract track IDs from URIs and get popularity data
			const trackIds = extractTrackIdsFromUris(spotifyUris);
			const trackPopularityData = await getTracksPopularity(trackIds);

			// Add popularity data to submissions
			const submissionsWithPopularity = submissions.map(submission => {
				const uri = submission['Spotify URI'];
				const trackId = extractTrackIdsFromUris([uri])[0];
				const popularity = trackPopularityData[trackId]?.popularity || null;

				return {
					...submission,
					popularity
				};
			});

			const processedData = {
				competitors,
				rounds,
				submissions: submissionsWithPopularity,
				votes,
				trackPopularityData
			};

			setData(processedData);
			const calculatedSuperlatives = calculateAllSuperlatives(processedData);
			setSuperlatives(calculatedSuperlatives);
			setLoading(false);
		} catch (err) {
			console.error('Error processing data:', err);
			setError('Failed to process data. Please check your CSV files and try again.');
			setLoading(false);
		}
	};

	const handleTabChange = (event, newValue) => {
		setTabValue(newValue);
	};

	const allFilesUploaded = Object.values(uploadedFiles).every(file => file !== null);

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
				<CircularProgress />
				<Typography variant="h6" sx={{ ml: 2 }}>Processing Music League data...</Typography>
			</Box>
		);
	}

	// Show upload interface if no data has been processed yet
	if (!data || !superlatives) {
		return (
			<Container maxWidth="lg" sx={{ mt: 4, mb: 4, px: { xs: 2, sm: 3, md: 4 } }}>
				<Typography variant="h3" component="h1" gutterBottom align="center" sx={{ fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
					Music League Wrapped
				</Typography>

				<Typography variant="h6" gutterBottom align="center" sx={{ mb: 4, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
					Upload your Music League CSV files to generate insights and awards
				</Typography>

				{/* Disclaimer */}
				<Typography
					variant="body2"
					align="center"
					sx={{
						mb: 4,
						fontSize: { xs: '0.875rem', sm: '1rem' },
						color: 'text.secondary',
						fontStyle: 'italic',
						px: 2
					}}
				>
					<strong>Disclaimer:</strong> This site is not endorsed by or affiliated with Music League.
					It is an independent project created by a fan of the app to provide additional insights
					and analytics for Music League participants.
				</Typography>

				{error && (
					<Alert severity="error" sx={{ mb: 3 }}>
						{error}
					</Alert>
				)}

				<Grid container spacing={3} sx={{ mb: 4, justifyContent: 'center' }}>
					<Grid item xs={12} sm={6} lg={6} xl={3}>
						<FileUploadZone
							onFileUpload={(data, fileName) => handleFileUpload(data, fileName, 'competitors')}
							fileName={fileNames.competitors}
							isUploaded={!!uploadedFiles.competitors}
							label="Competitors"
							description="Upload competitors.csv"
						/>
					</Grid>
					<Grid item xs={12} sm={6} lg={6} xl={3}>
						<FileUploadZone
							onFileUpload={(data, fileName) => handleFileUpload(data, fileName, 'rounds')}
							fileName={fileNames.rounds}
							isUploaded={!!uploadedFiles.rounds}
							label="Rounds"
							description="Upload rounds.csv"
						/>
					</Grid>
					<Grid item xs={12} sm={6} lg={6} xl={3}>
						<FileUploadZone
							onFileUpload={(data, fileName) => handleFileUpload(data, fileName, 'submissions')}
							fileName={fileNames.submissions}
							isUploaded={!!uploadedFiles.submissions}
							label="Submissions"
							description="Upload submissions.csv"
						/>
					</Grid>
					<Grid item xs={12} sm={6} lg={6} xl={3}>
						<FileUploadZone
							onFileUpload={(data, fileName) => handleFileUpload(data, fileName, 'votes')}
							fileName={fileNames.votes}
							isUploaded={!!uploadedFiles.votes}
							label="Votes"
							description="Upload votes.csv"
						/>
					</Grid>
				</Grid>

				<Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
					<Button
						variant="contained"
						size="large"
						onClick={processData}
						disabled={!allFilesUploaded}
						sx={{ px: 4, py: 1.5 }}
					>
						Generate Music League Wrapped
					</Button>
				</Box>
			</Container>
		);
	}

	// Show the dashboard once data is processed
	return (
		<DashboardContent
			data={data}
			superlatives={superlatives}
			season="uploaded"
			tabValue={tabValue}
			onTabChange={handleTabChange}
			title="Music League Wrapped"
			subtitle="Insights and Awards from Your Music League"
		/>
	);
};

export default UploadDashboard; 