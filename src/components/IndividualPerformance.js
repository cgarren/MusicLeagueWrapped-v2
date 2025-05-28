import React, { useState, useEffect } from 'react';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Grid, Card, CardContent, useTheme, useMediaQuery } from '@mui/material';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const IndividualPerformance = ({ data, season }) => {
	const [selectedIndividual, setSelectedIndividual] = useState('');
	const [individualStats, setIndividualStats] = useState(null);
	const [individualSubmissions, setIndividualSubmissions] = useState([]);
	const [scatterData, setScatterData] = useState([]);
	const theme = useTheme();
	const isMediumScreen = useMediaQuery(theme.breakpoints.down('md'));

	useEffect(() => {
		// Reset selection when season changes
		setSelectedIndividual('');
		setIndividualStats(null);
		setIndividualSubmissions([]);
		setScatterData([]);
	}, [season]);

	useEffect(() => {
		if (!selectedIndividual || !data) return;

		// Calculate all the statistics for the selected individual
		const calculateIndividualStats = () => {
			if (!data || !selectedIndividual) return;

			const { competitors, submissions, votes, rounds } = data;

			// Get individual info
			const individual = competitors.find(comp => comp.ID === selectedIndividual);
			if (!individual) return;

			// Get all submissions by this individual
			const individualSubmissions = submissions.filter(sub =>
				sub['Submitter ID'] === selectedIndividual
			);

			// Process submissions to include round details and vote counts
			const processedSubmissions = individualSubmissions.map(submission => {
				const round = rounds.find(r => r.ID === submission['Round ID']);
				const roundIndex = rounds.findIndex(r => r.ID === submission['Round ID']);
				const submissionVotes = votes.filter(vote => vote['Spotify URI'] === submission['Spotify URI']);
				const totalVotes = submissionVotes.reduce((sum, vote) => sum + parseInt(vote['Points Assigned'] || 0), 0);

				return {
					...submission,
					roundName: round?.Name || 'Unknown',
					roundNumber: roundIndex + 1,
					totalVotes
				};
			});

			// Sort by round index as defined in the rounds data
			processedSubmissions.sort((a, b) => {
				return a.roundNumber - b.roundNumber;
			});

			setIndividualSubmissions(processedSubmissions);

			// Calculate relative performance (normalize votes between 0-1 based on this individual's submissions)
			const maxVotes = Math.max(...processedSubmissions.map(sub => sub.totalVotes));
			const minVotes = Math.min(...processedSubmissions.map(sub => sub.totalVotes));
			const voteRange = maxVotes - minVotes;

			// Create scatter plot data
			const scatterPlotData = processedSubmissions
				.filter(sub => sub.popularity !== null && sub.popularity !== undefined)
				.map(sub => {
					// Calculate relative performance (0-1 scale)
					const relativePerformance = voteRange > 0
						? (sub.totalVotes - minVotes) / voteRange
						: 0.5; // If all songs got same votes, place at middle

					return {
						x: sub.popularity,
						y: relativePerformance,
						title: sub.Title,
						artist: sub['Artist(s)'],
						votes: sub.totalVotes,
						roundName: sub.roundName,
						roundNumber: sub.roundNumber
					};
				});

			setScatterData(scatterPlotData);

			// Calculate overall rank
			const individualPointsMap = {};

			submissions.forEach(submission => {
				const submitterId = submission['Submitter ID'];
				const submissionVotes = votes.filter(vote => vote['Spotify URI'] === submission['Spotify URI']);
				const totalVotes = submissionVotes.reduce((sum, vote) => sum + parseInt(vote['Points Assigned'] || 0), 0);

				individualPointsMap[submitterId] = (individualPointsMap[submitterId] || 0) + totalVotes;
			});

			const sortedIndividuals = Object.entries(individualPointsMap)
				.map(([id, points]) => ({ id, points }))
				.sort((a, b) => b.points - a.points);

			const rank = sortedIndividuals.findIndex(c => c.id === selectedIndividual) + 1;

			// Find biggest fan (who gave them the most points)
			const pointsByVoter = {};

			votes.forEach(vote => {
				const submission = submissions.find(sub => sub['Spotify URI'] === vote['Spotify URI']);
				if (!submission || submission['Submitter ID'] !== selectedIndividual) return;

				const voterId = vote['Voter ID'];
				pointsByVoter[voterId] = (pointsByVoter[voterId] || 0) + parseInt(vote['Points Assigned'] || 0);
			});

			let biggestFan = null;
			let biggestFanPoints = 0;
			let biggestCritic = null;
			let biggestCriticPoints = Infinity;

			Object.entries(pointsByVoter).forEach(([voterId, points]) => {
				// Skip if the voter is the same as the selected individual
				if (voterId === selectedIndividual) return;

				if (points > biggestFanPoints) {
					biggestFanPoints = points;
					biggestFan = competitors.find(comp => comp.ID === voterId);
				}
				if (points < biggestCriticPoints) {
					biggestCriticPoints = points;
					biggestCritic = competitors.find(comp => comp.ID === voterId);
				}
			});

			// Find most compatible with
			// Calculate average points exchanged between pairs
			const pairScores = [];

			competitors.forEach(otherComp => {
				if (otherComp.ID === selectedIndividual) return;

				// Points from selectedIndividual to otherComp
				const votesToOther = votes.filter(vote => {
					const submission = submissions.find(sub => sub['Spotify URI'] === vote['Spotify URI']);
					return submission &&
						submission['Submitter ID'] === otherComp.ID &&
						vote['Voter ID'] === selectedIndividual;
				});

				let avgPointsToOther = 0;
				if (votesToOther.length > 0) {
					const totalPointsToOther = votesToOther.reduce((sum, vote) => sum + parseInt(vote['Points Assigned'] || 0), 0);
					avgPointsToOther = totalPointsToOther / votesToOther.length;
				}

				// Points from otherComp to selectedIndividual
				const votesFromOther = votes.filter(vote => {
					const submission = submissions.find(sub => sub['Spotify URI'] === vote['Spotify URI']);
					return submission &&
						submission['Submitter ID'] === selectedIndividual &&
						vote['Voter ID'] === otherComp.ID;
				});

				let avgPointsFromOther = 0;
				if (votesFromOther.length > 0) {
					const totalPointsFromOther = votesFromOther.reduce((sum, vote) => sum + parseInt(vote['Points Assigned'] || 0), 0);
					avgPointsFromOther = totalPointsFromOther / votesFromOther.length;
				}

				// Geometric mean of the average points
				const compatibilityScore = Math.sqrt(avgPointsToOther * avgPointsFromOther);

				pairScores.push({
					competitor: otherComp,
					score: compatibilityScore,
					avgPointsToOther,
					avgPointsFromOther
				});
			});

			pairScores.sort((a, b) => b.score - a.score);
			const mostCompatible = pairScores.length > 0 ? pairScores[0] : null;

			// Find most similar to (based on voting patterns)
			const voterSimilarities = [];

			competitors.forEach(otherComp => {
				if (otherComp.ID === selectedIndividual) return;

				// Get all votes by selectedIndividual
				const selectedVotes = votes.filter(vote => vote['Voter ID'] === selectedIndividual);

				// Get all votes by otherComp
				const otherVotes = votes.filter(vote => vote['Voter ID'] === otherComp.ID);

				// Find common songs voted on
				const commonSongURIs = new Set();

				selectedVotes.forEach(vote => {
					const uri = vote['Spotify URI'];
					if (otherVotes.some(otherVote => otherVote['Spotify URI'] === uri)) {
						commonSongURIs.add(uri);
					}
				});

				// Calculate similarity if there are common songs
				if (commonSongURIs.size > 0) {
					let totalDifference = 0;
					let count = 0;

					commonSongURIs.forEach(uri => {
						const selectedVote = selectedVotes.find(vote => vote['Spotify URI'] === uri);
						const otherVote = otherVotes.find(vote => vote['Spotify URI'] === uri);

						if (selectedVote && otherVote) {
							const diff = Math.abs(
								parseInt(selectedVote['Points Assigned'] || 0) -
								parseInt(otherVote['Points Assigned'] || 0)
							);
							totalDifference += diff;
							count++;
						}
					});

					const avgDifference = count > 0 ? totalDifference / count : 0;
					const similarity = count > 0 ? 1 / (1 + avgDifference) : 0; // Higher value = more similar

					voterSimilarities.push({
						competitor: otherComp,
						similarity,
						commonSongs: commonSongURIs.size
					});
				}
			});

			voterSimilarities.sort((a, b) => b.similarity - a.similarity);
			const mostSimilar = voterSimilarities.length > 0 ? voterSimilarities[0] : null;

			// Calculate average song popularity
			const avgPopularity = individualSubmissions.reduce((sum, sub) => sum + (sub.popularity || 0), 0) /
				(individualSubmissions.filter(sub => sub.popularity !== null).length || 1);

			// Find the song that got the most votes
			let bestSong = null;
			let bestSongVotes = 0;

			individualSubmissions.forEach(sub => {
				const submissionVotes = votes.filter(vote => vote['Spotify URI'] === sub['Spotify URI']);
				const totalVotes = submissionVotes.reduce((sum, vote) => sum + parseInt(vote['Points Assigned'] || 0), 0);

				if (totalVotes > bestSongVotes) {
					bestSongVotes = totalVotes;
					bestSong = sub;
				}
			});

			// Calculate voting speed rank
			const voterTimestamps = {};

			votes.forEach(vote => {
				const roundId = vote['Round ID'];
				const voterId = vote['Voter ID'];
				const timestamp = new Date(vote['Created']).getTime();

				if (!voterTimestamps[roundId]) {
					voterTimestamps[roundId] = {};
				}

				if (!voterTimestamps[roundId][voterId] || timestamp < voterTimestamps[roundId][voterId]) {
					voterTimestamps[roundId][voterId] = timestamp;
				}
			});

			// Calculate average rank per round
			let totalRank = 0;
			let roundsCount = 0;

			Object.entries(voterTimestamps).forEach(([roundId, voterTimes]) => {
				// Sort voters by timestamp
				const sortedVoters = Object.entries(voterTimes)
					.map(([voterId, timestamp]) => ({ voterId, timestamp }))
					.sort((a, b) => a.timestamp - b.timestamp);

				const voterRank = sortedVoters.findIndex(voter => voter.voterId === selectedIndividual) + 1;

				if (voterRank > 0) {
					totalRank += voterRank;
					roundsCount++;
				}
			});

			const avgVotingSpeedRank = roundsCount > 0 ? totalRank / roundsCount : 0;

			// Generate stats object
			setIndividualStats({
				individual,
				rank,
				biggestFan,
				biggestFanPoints,
				biggestCritic,
				biggestCriticPoints,
				mostCompatible: mostCompatible?.competitor,
				mostCompatibleScore: mostCompatible?.score,
				mostSimilar: mostSimilar?.competitor,
				mostSimilarScore: mostSimilar?.similarity,
				avgPopularity: avgPopularity.toFixed(1),
				bestSong,
				bestSongVotes,
				avgVotingSpeedRank: avgVotingSpeedRank.toFixed(1)
			});
		};

		calculateIndividualStats();
	}, [selectedIndividual, data]);

	const handleIndividualChange = (event) => {
		setSelectedIndividual(event.target.value);
	};

	// Custom tooltip for the scatter plot
	const CustomTooltip = ({ active, payload }) => {
		if (active && payload && payload.length) {
			const data = payload[0].payload;
			return (
				<Paper sx={{ p: 2, backgroundColor: 'white', border: `2px solid ${theme.palette.primary.main}` }}>
					<Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
						{data.title}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						by {data.artist}
					</Typography>
					<Typography variant="body2" sx={{ mt: 1 }}>
						Round {data.roundNumber}: {data.roundName}
					</Typography>
					<Typography variant="body2">
						Votes: {data.votes}
					</Typography>
					<Typography variant="body2">
						Spotify Popularity: {data.x}
					</Typography>
					<Typography variant="body2">
						Relative Performance: {(data.y * 100).toFixed(1)}%
					</Typography>
				</Paper>
			);
		}
		return null;
	};

	// If no individual is selected, show only the dropdown
	if (!selectedIndividual) {
		return (
			<Box sx={{ width: '100%', maxWidth: 500, mx: 'auto', mt: 4, mb: 4 }}>
				<Typography variant="h4" component="h2" gutterBottom align="center">
					Individual Performance
				</Typography>
				<FormControl fullWidth sx={{ mb: 4 }}>
					<InputLabel id="individual-select-label">Select Individual</InputLabel>
					<Select
						labelId="individual-select-label"
						id="individual-select"
						value={selectedIndividual}
						label="Select Individual"
						onChange={handleIndividualChange}
					>
						{data?.competitors.map((competitor) => (
							<MenuItem key={competitor.ID} value={competitor.ID}>
								{competitor.Name}
							</MenuItem>
						))}
					</Select>
				</FormControl>
			</Box>
		);
	}

	return (
		<Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', mt: 4, mb: 6 }}>
			<Typography variant="h4" component="h2" gutterBottom align="center">
				Individual Performance
			</Typography>

			<FormControl sx={{ minWidth: 200, mb: 4, display: 'block', mx: 'auto' }}>
				<InputLabel id="individual-select-label">Select Individual</InputLabel>
				<Select
					labelId="individual-select-label"
					id="individual-select"
					value={selectedIndividual}
					label="Select Individual"
					onChange={handleIndividualChange}
				>
					{data?.competitors.map((competitor) => (
						<MenuItem key={competitor.ID} value={competitor.ID}>
							{competitor.Name}
						</MenuItem>
					))}
				</Select>
			</FormControl>

			{individualStats && (
				<>
					<Typography variant="h5" component="h3" gutterBottom align="center" sx={{ mt: 3 }}>
						{individualStats.individual.Name}'s Performance
					</Typography>

					<Grid container spacing={3} sx={{ mb: 4 }}>
						<Grid item xs={12} sm={6} md={4}>
							<Card>
								<CardContent>
									<Typography variant="h6" gutterBottom>Overall Rank</Typography>
									<Typography variant="h4" color="primary">#{individualStats.rank}</Typography>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12} sm={6} md={4}>
							<Card>
								<CardContent>
									<Typography variant="h6" gutterBottom>Biggest Fan</Typography>
									<Typography variant="h5" color="primary">
										{individualStats.biggestFan?.Name || 'N/A'}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{individualStats.biggestFanPoints} total votes
									</Typography>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12} sm={6} md={4}>
							<Card>
								<CardContent>
									<Typography variant="h6" gutterBottom>Biggest Critic</Typography>
									<Typography variant="h5" color="primary">
										{individualStats.biggestCritic?.Name || 'N/A'}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{individualStats.biggestCriticPoints} total votes
									</Typography>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12} sm={6} md={4}>
							<Card>
								<CardContent>
									<Typography variant="h6" gutterBottom>Most Compatible With</Typography>
									<Typography variant="h5" color="primary">
										{individualStats.mostCompatible?.Name || 'N/A'}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										Based on average points exchanged
									</Typography>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12} sm={6} md={4}>
							<Card>
								<CardContent>
									<Typography variant="h6" gutterBottom>Most Similar To</Typography>
									<Typography variant="h5" color="primary">
										{individualStats.mostSimilar?.Name || 'N/A'}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										Based on similarity in voting patterns
									</Typography>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12} sm={6} md={4}>
							<Card>
								<CardContent>
									<Typography variant="h6" gutterBottom>Avg Song Popularity</Typography>
									<Typography variant="h4" color="primary">{individualStats.avgPopularity}</Typography>
									<Typography variant="body2" color="text.secondary">
										(Spotify popularity scale: 0-100)
									</Typography>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12} sm={6} md={4}>
							<Card>
								<CardContent>
									<Typography variant="h6" gutterBottom>Best Performing Song</Typography>
									<Typography variant="h5" color="primary">
										{individualStats.bestSong?.Title || 'N/A'}
									</Typography>
									<Typography variant="body2">
										by {individualStats.bestSong?.["Artist(s)"] || 'Unknown'}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{individualStats.bestSongVotes} total votes
									</Typography>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12} sm={6} md={4}>
							<Card>
								<CardContent>
									<Typography variant="h6" gutterBottom>Voting Speed Rank</Typography>
									<Typography variant="h4" color="primary">#{individualStats.avgVotingSpeedRank}</Typography>
									<Typography variant="body2" color="text.secondary">
										Average position in voting order
									</Typography>
								</CardContent>
							</Card>
						</Grid>
					</Grid>

					<Typography variant="h5" component="h3" gutterBottom sx={{ mt: 5, mb: 2 }}>
						Submitted Songs
					</Typography>

					<TableContainer component={Paper}>
						<Table sx={{ minWidth: 650 }} aria-label="submissions table">
							<TableHead>
								<TableRow>
									<TableCell>Round #</TableCell>
									<TableCell>Prompt</TableCell>
									<TableCell>Song</TableCell>
									<TableCell>Artist(s)</TableCell>
									<TableCell align="right">Popularity</TableCell>
									<TableCell align="right">Votes</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{individualSubmissions.map((submission) => (
									<TableRow
										key={submission['Spotify URI'] + submission['Round ID']}
										sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
									>
										<TableCell component="th" scope="row">
											{submission.roundNumber}
										</TableCell>
										<TableCell>
											{submission.roundName}
										</TableCell>
										<TableCell>{submission.Title}</TableCell>
										<TableCell>{submission["Artist(s)"]}</TableCell>
										<TableCell align="right">{submission.popularity || 'N/A'}</TableCell>
										<TableCell align="right">{submission.totalVotes}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>

					{/* Performance vs Popularity Scatter Plot */}
					{scatterData.length > 0 && (
						<Card sx={{ mt: 4 }}>
							<CardContent>
								<Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
									🎵 Song Performance vs Spotify Popularity
								</Typography>
								<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
									How well did your songs perform relative to their mainstream popularity?
								</Typography>
								<Box sx={{
									width: '100%',
									height: { xs: 400, sm: 450, md: 500 },
									minHeight: { xs: 350, sm: 400 }
								}}>
									<ResponsiveContainer width="100%" height="100%">
										<ScatterChart
											margin={{
												top: 20,
												right: isMediumScreen ? 20 : 80,
												bottom: isMediumScreen ? 40 : 60,
												left: isMediumScreen ? 10 : 20,
											}}
										>
											<CartesianGrid
												strokeDasharray="3 3"
												stroke={theme.palette.divider}
												opacity={0.3}
											/>
											<XAxis
												type="number"
												dataKey="x"
												name="Spotify Popularity"
												domain={[0, 100]}
												tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }}
												label={{
													value: isMediumScreen ? 'Spotify Popularity' : 'Spotify Popularity (0-100)',
													position: 'bottom',
													offset: isMediumScreen ? -5 : -10,
													style: {
														textAnchor: 'middle',
														fill: theme.palette.text.primary,
														fontSize: isMediumScreen ? '12px' : '14px',
														fontWeight: 'bold'
													}
												}}
											/>
											<YAxis
												type="number"
												dataKey="y"
												name="Relative Performance"
												domain={[0, 1]}
												tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }}
												tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
												label={{
													value: isMediumScreen ? 'Performance' : 'Relative Performance (0-100%)',
													angle: -90,
													position: 'insideLeft',
													style: {
														textAnchor: 'middle',
														fill: theme.palette.text.primary,
														fontSize: isMediumScreen ? '12px' : '14px',
														fontWeight: 'bold'
													}
												}}
											/>
											<Tooltip content={({ active, payload }) => {
												if (active && payload && payload.length) {
													const data = payload[0].payload;
													return (
														<Paper sx={{
															p: { xs: 1.5, sm: 2 },
															backgroundColor: 'white',
															border: `2px solid ${theme.palette.primary.main}`,
															maxWidth: { xs: '250px', sm: '300px' },
															fontSize: { xs: '0.875rem', sm: '1rem' }
														}}>
															<Typography variant="subtitle2" sx={{
																fontWeight: 'bold',
																color: theme.palette.primary.main,
																fontSize: { xs: '0.875rem', sm: '1rem' }
															}}>
																{data.title}
															</Typography>
															<Typography variant="body2" color="text.secondary" sx={{
																fontSize: { xs: '0.75rem', sm: '0.875rem' }
															}}>
																by {data.artist}
															</Typography>
															<Typography variant="body2" sx={{
																mt: 1,
																fontSize: { xs: '0.75rem', sm: '0.875rem' }
															}}>
																Round {data.roundNumber}: {data.roundName}
															</Typography>
															<Typography variant="body2" sx={{
																fontSize: { xs: '0.75rem', sm: '0.875rem' }
															}}>
																Votes: {data.votes}
															</Typography>
															<Typography variant="body2" sx={{
																fontSize: { xs: '0.75rem', sm: '0.875rem' }
															}}>
																Spotify Popularity: {data.x}
															</Typography>
															<Typography variant="body2" sx={{
																fontSize: { xs: '0.75rem', sm: '0.875rem' }
															}}>
																Relative Performance: {(data.y * 100).toFixed(1)}%
															</Typography>
														</Paper>
													);
												}
												return null;
											}} />
											<Scatter
												data={scatterData}
												fill={theme.palette.primary.main}
											>
												{scatterData.map((entry, index) => (
													<Cell
														key={`cell-${index}`}
														fill={theme.palette.primary.main}
														fillOpacity={0.8}
														stroke={theme.palette.primary.dark}
														strokeWidth={2}
														r={isMediumScreen ? 8 : 6}
													/>
												))}
											</Scatter>
										</ScatterChart>
									</ResponsiveContainer>
								</Box>
								<Typography variant="body2" color="text.secondary" sx={{
									mt: 0,
									fontStyle: 'italic',
									fontSize: { xs: '0.75rem', sm: '0.875rem' }
								}}>
									{isMediumScreen ?
										'Tap points for song details. Higher points indicate better performance relative to your other submissions.' :
										'Hover over points to see song details. Higher points indicate better performance relative to your other submissions.'
									}
								</Typography>
							</CardContent>
						</Card>
					)}
				</>
			)}
		</Box>
	);
};

export default IndividualPerformance; 