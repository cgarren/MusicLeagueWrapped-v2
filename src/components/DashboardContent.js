import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Grid, Box, Tabs, Tab, useMediaQuery, useTheme, Card, CardContent, Paper, Modal, IconButton, Stack, FormControlLabel, Switch, Select, MenuItem, TextField, Autocomplete } from '@mui/material';
import { Close } from '@mui/icons-material';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend, LabelList } from 'recharts';

// Individual award components
import SuperlativeCard from './SuperlativeCard';
import VotingGraph from './VotingGraph';
import IndividualPerformance from './IndividualPerformance';

const DASHBOARD_COLOR_PALETTE = [
	'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
	'#800000', '#008000', '#000080', '#808000', '#800080', '#008080',
	'#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C',
	'#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD',
	'#F0E68C'
];

// Tab Panel component
function TabPanel(props) {
	const { children, value, index, ...other } = props;

	return (
		<div
			role="tabpanel"
			hidden={value !== index}
			id={`simple-tabpanel-${index}`}
			aria-labelledby={`simple-tab-${index}`}
			{...other}
		>
			{value === index && (
				<Box sx={{ pt: 3 }}>
					{children}
				</Box>
			)}
		</div>
	);
}

// Tab helper function for accessibility
function a11yProps(index) {
	return {
		id: `simple-tab-${index}`,
		'aria-controls': `simple-tabpanel-${index}`,
	};
}

const DashboardContent = ({
	data,
	superlatives,
	season,
	tabValue,
	onTabChange,
	title = "Music League Wrapped",
	subtitle = "Insights and Awards from Music League",
	headerContent = null
}) => {
	const theme = useTheme();
	const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
	const isMediumScreen = useMediaQuery(theme.breakpoints.down('md'));

	// State for round details modal
	const [selectedRound, setSelectedRound] = useState(null);
	const [modalOpen, setModalOpen] = useState(false);

	// State for chart tabs
	const [chartTabValue, setChartTabValue] = useState(0);

	// Interaction state for performance charts
	const [hoveredSeries, setHoveredSeries] = useState(null);
	const [onlyTopN, setOnlyTopN] = useState(false);
	const [topN, setTopN] = useState(5);
	const [highlightName, setHighlightName] = useState('');
	const [timingHighlight, setTimingHighlight] = useState('');

	const handleRoundClick = (roundData, roundNumber) => {
		setSelectedRound({ roundData, roundNumber });
		setModalOpen(true);
	};

	const handleModalClose = () => {
		setModalOpen(false);
		setSelectedRound(null);
	};

	const handleChartTabChange = (event, newValue) => {
		setChartTabValue(newValue);
	};

	// Function to generate performance data (round-by-round or cumulative)
	const generatePerformanceData = (isCumulative = false) => {
		if (!data?.submissions || !data?.votes || !data?.competitors || !data?.rounds) return [];

		// Calculate vote totals for each submission
		const submissionVotes = {};
		data.votes.forEach(vote => {
			const uri = vote['Spotify URI'];
			submissionVotes[uri] = (submissionVotes[uri] || 0) + parseInt(vote['Points Assigned'] || 0);
		});

		// Create a map of round IDs to round numbers for proper ordering
		const roundOrder = {};
		data.rounds.forEach((round, index) => {
			roundOrder[round.ID] = index + 1;
		});

		// Group submissions by competitor and round
		const competitorRoundData = {};
		data.submissions.forEach(submission => {
			const competitorId = submission['Submitter ID'];
			const roundId = submission['Round ID'];
			const roundNumber = roundOrder[roundId];
			const votes = submissionVotes[submission['Spotify URI']] || 0;

			if (!competitorRoundData[competitorId]) {
				competitorRoundData[competitorId] = {};
			}
			competitorRoundData[competitorId][roundNumber] = votes;
		});

		// Create chart data structure
		const chartData = [];
		const maxRounds = Math.max(...data.rounds.map((_, index) => index + 1));

		// Track cumulative totals for each competitor
		const cumulativeTotals = {};
		data.competitors.forEach(competitor => {
			if (competitor && competitor.Name) {
				cumulativeTotals[competitor.Name] = 0;
			}
		});

		for (let round = 1; round <= maxRounds; round++) {
			const roundData = { round };

			data.competitors.forEach(competitor => {
				if (competitor && competitor.Name) {
					const hasSubmission = competitorRoundData[competitor.ID]?.hasOwnProperty(round);
					if (hasSubmission) {
						const roundVotes = competitorRoundData[competitor.ID][round];
						if (isCumulative) {
							// Add to cumulative total
							cumulativeTotals[competitor.Name] += roundVotes;
							roundData[competitor.Name] = cumulativeTotals[competitor.Name];
						} else {
							// Use round votes directly
							roundData[competitor.Name] = roundVotes;
						}
					} else {
						if (isCumulative) {
							// For cumulative, continue with previous total (no gap)
							roundData[competitor.Name] = cumulativeTotals[competitor.Name];
						} else {
							// For round-by-round, use null to create gap
							roundData[competitor.Name] = null;
						}
					}
				}
			});

			chartData.push(roundData);
		}

		return chartData;
	};

	// Helper: get filtered competitor list based on Top N and highlight selection
	const getFilteredCompetitors = (chartData) => {
		const names = (data?.competitors || [])
			.filter(c => c && c.Name)
			.map(c => c.Name);

		if (!onlyTopN) return new Set(names);

		// Compute last available value per competitor
		const lastVals = names.map(name => {
			let lastVal = null;
			for (let i = chartData.length - 1; i >= 0; i--) {
				const v = chartData[i]?.[name];
				if (v !== null && v !== undefined) { lastVal = v; break; }
			}
			return { name, value: lastVal ?? -Infinity };
		});

		const sorted = lastVals.sort((a, b) => (b.value - a.value));
		const cutoff = Math.max(0, topN);
		const topList = new Set(sorted.slice(0, cutoff).map(x => x.name));
		// Always include highlighted selection if present
		if (highlightName) topList.add(highlightName);
		return topList;
	};

	// Helper: compute last data index and label vertical offsets to minimize overlap
	const getEndLabelMeta = (chartData, visibleSet) => {
		const names = (data?.competitors || []).filter(c => c && c.Name).map(c => c.Name).filter(n => !visibleSet || visibleSet.has(n));
		const lastIndexByName = {};
		const lastValueByName = {};
		names.forEach(name => {
			let idx = -1;
			for (let i = chartData.length - 1; i >= 0; i--) {
				const v = chartData[i]?.[name];
				if (v !== null && v !== undefined) { idx = i; break; }
			}
			lastIndexByName[name] = idx;
			lastValueByName[name] = idx >= 0 ? chartData[idx][name] : -Infinity;
		});

		// Sort by last value to stack labels vertically
		const sortedNames = names
			.filter(n => lastIndexByName[n] >= 0)
			.sort((a, b) => (lastValueByName[a] - lastValueByName[b]));

		const dyByName = {};
		const gap = 12; // pixels between labels
		sortedNames.forEach((n, i) => {
			// Center the stack around 0 for better distribution
			const centerOffset = (sortedNames.length - 1) * gap / 2;
			dyByName[n] = i * gap - centerOffset;
		});

		return { lastIndexByName, dyByName };
	};

	const formatTimingDetail = (entryLabel, entry) => {
		if (!entry || !entry.score) {
			return 'Not enough submissions to calculate this metric yet.';
		}

		const timingPercent = entry.avgPosition ? parseInt(entry.avgPosition) : null;
		let timingDescription = 'N/A';
		if (timingPercent !== null) {
			if (timingPercent <= 50) {
				timingDescription = `In the first ${timingPercent}% of submitters, on average`;
			} else {
				timingDescription = `In the last ${100 - timingPercent}% of submitters, on average`;
			}
		}

		const performancePercent = entry.avgPerformance ? parseInt(entry.avgPerformance) : null;
		const performanceDescription = performancePercent !== null
			? `Averaged ${performancePercent}% performance across all songs`
			: 'N/A';

		const roundsDescription = entry.roundCount
			? `Based on ${entry.roundCount} submission${entry.roundCount !== 1 ? 's' : ''}`
			: 'N/A';

		return `${entryLabel} Submitter Score: ${entry.score}

Submission timing: ${timingDescription}
Song performance: ${performanceDescription}
${roundsDescription}`;
	};

	const timingColorMap = useMemo(() => {
		const map = new Map();
		(data?.competitors || []).forEach((competitor, index) => {
			if (competitor?.ID) {
				map.set(competitor.ID, DASHBOARD_COLOR_PALETTE[index % DASHBOARD_COLOR_PALETTE.length]);
			}
		});
		return map;
	}, [data?.competitors]);

	const submissionTimingData = useMemo(() => {
		if (!superlatives?.submissionTimingData || !data?.competitors) return [];
		const competitorMap = new Map(
			data.competitors
				.filter(c => c && c.ID)
				.map(c => [c.ID, c.Name])
		);

		return superlatives.submissionTimingData
			.map(entry => {
				const competitorName = competitorMap.get(entry.submitterId);
				if (!competitorName) return null;

				const submissionPercent = entry.submissionPosition !== undefined
					? Number((entry.submissionPosition * 100).toFixed(1))
					: null;
				const performancePercent = entry.normalizedPerformance !== undefined
					? Number((entry.normalizedPerformance * 100).toFixed(1))
					: null;

				return {
					...entry,
					competitorName,
					submissionPercent,
					performancePercent,
					color: timingColorMap.get(entry.submitterId) || '#7a7a7a'
				};
			})
			.filter(Boolean);
	}, [superlatives?.submissionTimingData, data?.competitors, timingColorMap]);

	const timingLegendCompetitors = useMemo(() => {
		const seen = new Map();
		submissionTimingData.forEach(item => {
			if (!seen.has(item.submitterId)) {
				seen.set(item.submitterId, {
					id: item.submitterId,
					name: item.competitorName,
					color: item.color
				});
			}
		});
		return Array.from(seen.values());
	}, [submissionTimingData]);

	const timingCompetitorNames = useMemo(() => {
		return timingLegendCompetitors
			.map(item => item.name)
			.filter(Boolean)
			.sort((a, b) => a.localeCompare(b));
	}, [timingLegendCompetitors]);

	useEffect(() => {
		if (timingHighlight && !timingCompetitorNames.includes(timingHighlight)) {
			setTimingHighlight('');
		}
	}, [timingHighlight, timingCompetitorNames]);

	const filteredTimingData = useMemo(() => {
		if (!timingHighlight) return submissionTimingData;
		return submissionTimingData.filter(item => item.competitorName === timingHighlight);
	}, [submissionTimingData, timingHighlight]);

	const hasTimingData = submissionTimingData.length > 0;
	const earlyBirdData = superlatives?.earlyBirdLateBloomer?.earlyBird;
	const lastMinuteData = superlatives?.earlyBirdLateBloomer?.lastMinute;

	return (
		<Container maxWidth="xl" sx={{ mt: 4, mb: 4, px: { xs: 2, sm: 3, md: 4 } }}>
			<Typography variant="h3" component="h1" gutterBottom align="center" sx={{ fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
				{title}
			</Typography>

			<Typography variant="h6" gutterBottom align="center" sx={{ mb: 3, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
				{subtitle}
			</Typography>

			{/* Optional header content (e.g., season selector) */}
			{headerContent}

			{/* Tab Navigation */}
			<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
				<Tabs value={tabValue} onChange={onTabChange} aria-label="dashboard tabs" centered>
					<Tab label="League Overview" {...a11yProps(0)} />
					<Tab label="Individual Performance" {...a11yProps(1)} />
				</Tabs>
			</Box>

			{/* League Overview Tab */}
			<TabPanel value={tabValue} index={0}>
				{/* Voting Graph Visualization */}
				<Box sx={{
					display: 'flex',
					justifyContent: 'center',
					mb: 6,
					width: '100%',
					overflowX: 'auto'
				}}>
					<VotingGraph
						competitors={data.competitors}
						votes={data.votes}
						submissions={data.submissions}
					/>
				</Box>

				{/* League Performance vs Popularity Scatter Plot */}
				<Box sx={{ mb: 6, width: '100%' }}>
					<Card>
						<CardContent>
							<Typography variant="h5" component="h2" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
								🎵 League Songs: Performance vs Spotify Popularity
							</Typography>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
								How popular was the music you submitted? Each point represents a song colored by its submitter.
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
															Submitted by: {data.submitter}
														</Typography>
														<Typography variant="body2" sx={{
															fontSize: { xs: '0.75rem', sm: '0.875rem' }
														}}>
															Round: {data.roundName}
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
											data={(() => {
												// Calculate scatter plot data for all songs
												if (!data?.submissions || !data?.votes || !data?.competitors || !data?.rounds) return [];

												// Calculate vote totals for each submission
												const submissionVotes = {};
												data.votes.forEach(vote => {
													const uri = vote['Spotify URI'];
													submissionVotes[uri] = (submissionVotes[uri] || 0) + parseInt(vote['Points Assigned'] || 0);
												});

												// Get all vote totals for normalization
												const allVoteTotals = Object.values(submissionVotes);
												const maxVotes = Math.max(...allVoteTotals);
												const minVotes = Math.min(...allVoteTotals);
												const voteRange = maxVotes - minVotes;

												// Process submissions into scatter plot data
												return data.submissions
													.filter(sub => sub.popularity !== null && sub.popularity !== undefined)
													.map(sub => {
														const votes = submissionVotes[sub['Spotify URI']] || 0;
														const relativePerformance = voteRange > 0
															? (votes - minVotes) / voteRange
															: 0.5;

														const submitter = data.competitors.find(comp => comp.ID === sub['Submitter ID']);
														const round = data.rounds.find(r => r.ID === sub['Round ID']);

														return {
															x: sub.popularity,
															y: relativePerformance,
															title: sub.Title,
															artist: sub['Artist(s)'],
															submitter: submitter?.Name || 'Unknown',
															roundName: round?.Name || 'Unknown',
															votes: votes
														};
													});
											})()}
											fill={theme.palette.primary.main}
										>
											{(() => {
												// Calculate scatter plot data for all songs (same as above)
												if (!data?.submissions || !data?.votes || !data?.competitors || !data?.rounds) return [];

												const submissionVotes = {};
												data.votes.forEach(vote => {
													const uri = vote['Spotify URI'];
													submissionVotes[uri] = (submissionVotes[uri] || 0) + parseInt(vote['Points Assigned'] || 0);
												});

												const allVoteTotals = Object.values(submissionVotes);
												const maxVotes = Math.max(...allVoteTotals);
												const minVotes = Math.min(...allVoteTotals);
												const voteRange = maxVotes - minVotes;

												const scatterData = data.submissions
													.filter(sub => sub.popularity !== null && sub.popularity !== undefined)
													.map(sub => {
														const votes = submissionVotes[sub['Spotify URI']] || 0;
														const relativePerformance = voteRange > 0
															? (votes - minVotes) / voteRange
															: 0.5;

														return {
															x: sub.popularity,
															y: relativePerformance,
															submitterId: sub['Submitter ID']
														};
													});

												// Create color mapping for each competitor
												const colors = [
													'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'
												];

												return scatterData.map((entry, index) => {
													const competitorIndex = data.competitors.findIndex(comp => comp.ID === entry.submitterId);
													const colorIndex = competitorIndex >= 0 ? competitorIndex % colors.length : 0;

													return (
														<Cell
															key={`cell-${index}`}
															fill={colors[colorIndex]}
															fillOpacity={0.7}
															stroke={colors[colorIndex]}
															strokeWidth={2}
															r={isMediumScreen ? 6 : 8}
														/>
													);
												});
											})()}
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
									'Tap points for song details. Each color represents a different competitor.' :
									'Hover over points to see song details. Each color represents a different competitor. Higher points performed better relative to all songs in the league.'
								}
							</Typography>

							{/* Color Legend */}
							<Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
								<Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
									Competitor Legend:
								</Typography>
								<Box sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 1.5,
									justifyContent: 'center'
								}}>
									{(() => {
										const colors = [
											'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'
										];

										return data?.competitors?.map((competitor, index) => {
											if (!competitor || !competitor.Name) return null;
											const colorIndex = index % colors.length;

											return (
												<Box
													key={competitor.ID || index}
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 0.5,
														minWidth: 'fit-content'
													}}
												>
													<Box
														sx={{
															width: 12,
															height: 12,
															borderRadius: '50%',
															backgroundColor: colors[colorIndex],
															border: `2px solid ${colors[colorIndex]}`,
															flexShrink: 0
														}}
													/>
													<Typography
														variant="caption"
														sx={{
															fontSize: { xs: '0.7rem', sm: '0.75rem' },
															whiteSpace: 'nowrap'
														}}
													>
														{competitor.Name}
													</Typography>
												</Box>
											);
										}).filter(Boolean);
									})()}
								</Box>
							</Box>
						</CardContent>
					</Card>
				</Box>

				{/* Performance Over Time Line Chart */}
				<Box sx={{ mb: 6, width: '100%' }}>
					<Card>
						<CardContent>
							<Typography variant="h5" component="h2" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
								📈 Performance Over Time
							</Typography>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
								Track how each competitor's performance evolved throughout the season. Switch between round-by-round votes and cumulative totals.
							</Typography>

							{/* Chart Tabs */}
							<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
								<Tabs value={chartTabValue} onChange={handleChartTabChange} aria-label="chart tabs">
									<Tab label="Round-by-Round Votes" {...a11yProps(0)} />
									<Tab label="Total Votes" {...a11yProps(1)} />
								</Tabs>
							</Box>

							{/* Quick controls: Top N and highlight */}
							<Box sx={{
								display: 'flex',
								flexWrap: 'wrap',
								gap: 2,
								alignItems: 'center',
								justifyContent: 'space-between',
								mb: 2
							}}>
								<Stack direction="row" spacing={2} alignItems="center">
									<FormControlLabel
										control={<Switch checked={onlyTopN} onChange={(e) => setOnlyTopN(e.target.checked)} />}
										label={`Show Top ${topN}`}
									/>
									<Select size="small" value={topN} onChange={(e) => setTopN(Number(e.target.value))} disabled={!onlyTopN}>
										{[3, 5, 7, 10, 15, 20].map(n => (
											<MenuItem key={n} value={n}>{n}</MenuItem>
										))}
									</Select>
								</Stack>

								<Autocomplete
									sx={{ minWidth: 220, flex: 1, maxWidth: 320 }}
									size="small"
									options={(data?.competitors || []).filter(c => c && c.Name).map(c => c.Name)}
									value={highlightName || null}
									onChange={(_, value) => setHighlightName(value || '')}
									renderInput={(params) => <TextField {...params} label="Highlight competitor" placeholder="Type a name" />}
									clearOnEscape
								/>
							</Box>
							{/* Chart Tab Panels */}
							<TabPanel value={chartTabValue} index={0}>
								<Box sx={{
									width: '100%',
									height: { xs: 400, sm: 450, md: 500 },
									minHeight: { xs: 350, sm: 400 }
								}}>
									<ResponsiveContainer width="100%" height="100%">
										<LineChart
											data={generatePerformanceData(false)}
											margin={{
												top: 20,
												right: isMediumScreen ? 40 : 120,
												bottom: isMediumScreen ? 40 : 60,
												left: isMediumScreen ? 10 : 20,
											}}
											onClick={(data) => {
												if (data && data.activeLabel) {
													handleRoundClick(data.activePayload, data.activeLabel);
												}
											}}
										>
											<CartesianGrid
												strokeDasharray="3 3"
												stroke={theme.palette.divider}
												opacity={0.3}
											/>
											<XAxis
												dataKey="round"
												type="number"
												domain={['dataMin', 'dataMax']}
												tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }}
												label={{
													value: 'Round',
													position: 'insideBottom',
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
												tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }}
												label={{
													value: 'Votes Received',
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
											<Tooltip
												content={({ active, payload, label }) => {
													if (active && payload && payload.length) {
														const hasData = payload.some(entry => entry.value !== null);
														if (!hasData) return null;

														// Get round info
														const roundNumber = label;
														const currentRound = data.rounds?.[roundNumber - 1];

														// Find the winner(s) (highest votes)
														const competitorsWithVotes = payload
															.filter(entry => entry.value !== null)
															.sort((a, b) => (b.value || 0) - (a.value || 0));

														const topScore = competitorsWithVotes[0]?.value;
														const winners = competitorsWithVotes.filter(entry => entry.value === topScore);
														const isMultipleWinners = winners.length > 1;

														return (
															<Paper sx={{
																p: 1.5,
																backgroundColor: 'white',
																border: `2px solid ${theme.palette.primary.main}`,
																fontSize: '0.875rem',
																maxWidth: '280px'
															}}>
																<Typography variant="subtitle2" sx={{
																	fontWeight: 'bold',
																	color: theme.palette.primary.main,
																	mb: 0.5
																}}>
																	{currentRound?.Name || `Round ${label}`}
																</Typography>
																{winners.length > 0 && (
																	<Typography variant="body2" sx={{
																		mb: 0.5,
																		color: 'text.primary'
																	}}>
																		{isMultipleWinners ? 'Tied Winners' : 'Winner'}: {
																			isMultipleWinners
																				? winners.map(w => w.dataKey).join(', ')
																				: winners[0].dataKey
																		} ({topScore} votes)
																	</Typography>
																)}
																<Typography variant="caption" sx={{
																	color: 'text.secondary',
																	fontStyle: 'italic'
																}}>
																	Click to see detailed results
																</Typography>
															</Paper>
														);
													}
													return null;
												}}
											/>
											{/* Generate a line for each competitor with hover highlight and end labels */}
											{(() => {
												const colors = [
													'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'
												];

												const chartData = generatePerformanceData(false);
												const visibleSet = getFilteredCompetitors(chartData);
												const { lastIndexByName, dyByName } = getEndLabelMeta(chartData, visibleSet);

												return data?.competitors?.map((competitor, index) => {
													if (!competitor || !competitor.Name) return null;
													const colorIndex = index % colors.length;
													const name = competitor.Name;
													if (!visibleSet.has(name)) return null;

													const isHighlighted = (hoveredSeries === name) || (highlightName === name);
													const dimmed = !isHighlighted && (hoveredSeries || highlightName);

													return (
														<Line
															key={competitor.ID || index}
															type="linear"
															dataKey={name}
															stroke={colors[colorIndex]}
															strokeWidth={isHighlighted ? 3.5 : 1.5}
															strokeOpacity={dimmed ? 0.25 : 1}
															dot={false}
															connectNulls={false}
															activeDot={{ r: isHighlighted ? 7 : 5, strokeWidth: 2 }}
															onMouseEnter={() => setHoveredSeries(name)}
															onMouseLeave={() => setHoveredSeries(prev => (prev === name ? null : prev))}
														>
															<LabelList
																content={(props) => {
																	const { x, y, index } = props;
																	if (index !== lastIndexByName[name]) return null;
																	const dy = dyByName[name] || 0;
																	const color = colors[colorIndex];
																	const text = name;
																	return (
																		<g>
																			<text
																				x={(x || 0) + 6}
																				y={(y || 0) + dy}
																				fontSize={12}
																				fill={color}
																				stroke="#fff"
																				strokeWidth={3}
																				paintOrder="stroke"
																			>
																				{text}
																			</text>
																		</g>
																	);
																}}
															/>
														</Line>
													);
												}).filter(Boolean);
											})()}
										</LineChart>
									</ResponsiveContainer>
								</Box>
							</TabPanel>

							<TabPanel value={chartTabValue} index={1}>
								<Box sx={{
									width: '100%',
									height: { xs: 400, sm: 450, md: 500 },
									minHeight: { xs: 350, sm: 400 }
								}}>
									<ResponsiveContainer width="100%" height="100%">
										<LineChart
											data={generatePerformanceData(true)}
											margin={{
												top: 20,
												right: isMediumScreen ? 40 : 120,
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
												dataKey="round"
												type="number"
												domain={['dataMin', 'dataMax']}
												tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }}
												label={{
													value: 'Round',
													position: 'insideBottom',
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
												tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }}
												label={{
													value: 'Total Votes Received',
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
											<Tooltip
												content={({ active, payload, label }) => {
													if (active && payload && payload.length) {
														const hasData = payload.some(entry => entry.value !== null && entry.value !== undefined);
														if (!hasData) return null;

														// Get round info
														const roundNumber = label;
														const currentRound = data.rounds?.[roundNumber - 1];

														// Find the leader(s) (highest cumulative votes)
														const competitorsWithVotes = payload
															.filter(entry => entry.value !== null && entry.value !== undefined)
															.sort((a, b) => (b.value || 0) - (a.value || 0));

														const topScore = competitorsWithVotes[0]?.value;
														const leaders = competitorsWithVotes.filter(entry => entry.value === topScore);
														const isMultipleLeaders = leaders.length > 1;

														return (
															<Paper sx={{
																p: 1.5,
																backgroundColor: 'white',
																border: `2px solid ${theme.palette.primary.main}`,
																fontSize: '0.875rem',
																maxWidth: '280px'
															}}>
																<Typography variant="subtitle2" sx={{
																	fontWeight: 'bold',
																	color: theme.palette.primary.main,
																	mb: 0.5
																}}>
																	{currentRound?.Name || `Round ${label}`}
																</Typography>
																{leaders.length > 0 && (
																	<Typography variant="body2" sx={{
																		mb: 0.5,
																		color: 'text.primary'
																	}}>
																		{isMultipleLeaders ? 'Tied Leaders' : 'Leader'}: {
																			isMultipleLeaders
																				? leaders.map(l => l.dataKey).join(', ')
																				: leaders[0].dataKey
																		} ({topScore} total votes)
																	</Typography>
																)}
																<Typography variant="caption" sx={{
																	color: 'text.secondary',
																	fontStyle: 'italic'
																}}>
																	Cumulative totals through this round
																</Typography>
															</Paper>
														);
													}
													return null;
												}}
											/>
											{/* Generate a line for each competitor with hover/click highlight and end labels */}
											{(() => {
												const colors = [
													'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'
												];

												const chartData = generatePerformanceData(true);
												const visibleSet = getFilteredCompetitors(chartData);
												const { lastIndexByName, dyByName } = getEndLabelMeta(chartData, visibleSet);

												return data?.competitors?.map((competitor, index) => {
													if (!competitor || !competitor.Name) return null;
													const colorIndex = index % colors.length;
													const name = competitor.Name;
													if (!visibleSet.has(name)) return null;

													const isHighlighted = (hoveredSeries === name) || (highlightName === name);
													const dimmed = !isHighlighted && (hoveredSeries || highlightName);

													return (
														<Line
															key={competitor.ID || index}
															type="linear"
															dataKey={name}
															stroke={colors[colorIndex]}
															strokeWidth={isHighlighted ? 3.5 : 1.5}
															strokeOpacity={dimmed ? 0.25 : 1}
															dot={false}
															connectNulls={true}
															activeDot={{ r: isHighlighted ? 7 : 5, strokeWidth: 2 }}
															onMouseEnter={() => setHoveredSeries(name)}
															onMouseLeave={() => setHoveredSeries(prev => (prev === name ? null : prev))}
														>
															<LabelList
																content={(props) => {
																	const { x, y, index } = props;
																	if (index !== lastIndexByName[name]) return null;
																	const dy = dyByName[name] || 0;
																	const color = colors[colorIndex];
																	const text = name;
																	return (
																		<g>
																			<text
																				x={(x || 0) + 6}
																				y={(y || 0) + dy}
																				fontSize={12}
																				fill={color}
																				stroke="#fff"
																				strokeWidth={3}
																				paintOrder="stroke"
																			>
																				{text}
																			</text>
																		</g>
																	);
																}}
															/>
														</Line>
													);
												}).filter(Boolean);
											})()}
										</LineChart>
									</ResponsiveContainer>
								</Box>
							</TabPanel>
							<Typography variant="body2" color="text.secondary" sx={{
								mt: 2,
								fontStyle: 'italic',
								fontSize: { xs: '0.75rem', sm: '0.875rem' }
							}}>
								{chartTabValue === 0 ?
									(isMediumScreen ?
										'Tap anywhere on the chart to see detailed round results. Missing points indicate no submission in that round.' :
										'Click anywhere on the chart to see detailed round results with song information. Missing points indicate a competitor did not submit in that round.'
									) :
									(isMediumScreen ?
										'Shows cumulative vote totals over time. Lines continue smoothly even when competitors miss rounds.' :
										'Shows cumulative vote totals accumulated over time. Lines continue smoothly even when competitors miss rounds, showing their running total.'
									)
								}
							</Typography>

							{/* Color Legend */}
							<Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
								<Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
									Competitor Legend:
								</Typography>
								<Box sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 1.5,
									justifyContent: 'center'
								}}>
									{(() => {
										const colors = [
											'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'
										];

										return data?.competitors?.map((competitor, index) => {
											if (!competitor || !competitor.Name) return null;
											const colorIndex = index % colors.length;

											return (
												<Box
													key={competitor.ID || index}
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 0.5,
														minWidth: 'fit-content'
													}}
												>
													{/* Line indicator instead of dot */}
													<Box
														sx={{
															width: 20,
															height: 3,
															backgroundColor: colors[colorIndex],
															borderRadius: 1,
															flexShrink: 0
														}}
													/>
													<Typography
														variant="caption"
														sx={{
															fontSize: { xs: '0.7rem', sm: '0.75rem' },
															whiteSpace: 'nowrap'
														}}
													>
														{competitor.Name}
													</Typography>
												</Box>
											);
										}).filter(Boolean);
									})()}
								</Box>
							</Box>
						</CardContent>
					</Card>
				</Box>

				{/* Submission Timing vs Performance Graph */}
				{hasTimingData && (
					<Card sx={{ mb: 6 }}>
						<CardContent>
							<Typography variant="h5" component="h3" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
								📊 Submission Timing vs Performance
							</Typography>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
								Each point represents a song. The x-axis shows when it was submitted during the round (0% = first submission, 100% = last), and the y-axis shows how well it performed relative to the round.
							</Typography>

							<Box sx={{ maxWidth: 360, mb: 3 }}>
								<Autocomplete
									size="small"
									options={timingCompetitorNames}
									value={timingHighlight || null}
									onChange={(_, value) => setTimingHighlight(value || '')}
									renderInput={(params) => (
										<TextField {...params} label="Highlight competitor" placeholder="Show one competitor" />
									)}
									clearOnEscape
								/>
							</Box>

							<Box sx={{
								width: '100%',
								height: { xs: 360, sm: 420, md: 480 },
								minHeight: { xs: 320, sm: 360 }
							}}>
								<ResponsiveContainer width="100%" height="100%">
									<ScatterChart
										margin={{
											top: 20,
											right: isMediumScreen ? 20 : 60,
											bottom: isMediumScreen ? 40 : 60,
											left: isMediumScreen ? 10 : 20,
										}}
									>
										<CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={0.3} />
										<XAxis
											type="number"
											dataKey="submissionPercent"
											name="Submission Timing"
											domain={[0, 100]}
											tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }}
											label={{
												value: 'Submission Timing (0% = first, 100% = last)',
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
											dataKey="performancePercent"
											name="Normalized Performance"
											domain={[0, 100]}
											tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }}
											label={{
												value: 'Performance (0-100%)',
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
										<Tooltip
											content={({ active, payload }) => {
												if (active && payload && payload.length) {
													const dataPoint = payload[0].payload;
													return (
														<Paper sx={{
															p: { xs: 1.5, sm: 2 },
															backgroundColor: 'white',
															border: `2px solid ${theme.palette.primary.main}`,
															maxWidth: 300
														}}>
															<Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
																{dataPoint.title} — {dataPoint.competitorName}
															</Typography>
															<Typography variant="body2" color="text.secondary">
																Round: {dataPoint.roundName}
															</Typography>
															<Typography variant="body2">
																Submission order: {dataPoint.submissionOrder}/{dataPoint.totalSubmissions}
															</Typography>
															<Typography variant="body2">
																Votes: {dataPoint.votes}
															</Typography>
															<Typography variant="body2">
																Timing: {dataPoint.submissionPercent}%
															</Typography>
															<Typography variant="body2">
																Performance: {dataPoint.performancePercent}%
															</Typography>
														</Paper>
													);
												}
												return null;
											}}
										/>
										<Scatter
											data={filteredTimingData}
											fill={theme.palette.primary.main}
										>
											{filteredTimingData.map((entry, index) => (
												<Cell
													key={`timing-cell-${index}`}
													fill={entry.color}
													fillOpacity={timingHighlight ? 0.9 : 0.65}
													stroke={entry.color}
													strokeWidth={timingHighlight ? 2.5 : 1.5}
													r={timingHighlight ? 7 : 5}
												/>
											))}
										</Scatter>
									</ScatterChart>
								</ResponsiveContainer>
							</Box>
							<Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
								{isMediumScreen
									? 'Tap points for details. Colors match competitors.'
									: 'Hover over points to see song details. Each color represents a different competitor. Use the dropdown to focus on one competitor.'}
							</Typography>

							{/* Timing Color Legend */}
							<Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
								<Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
									Competitor Colors:
								</Typography>
								<Box sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 1.5,
									justifyContent: 'center'
								}}>
									{timingCompetitorNames.map((name, idx) => {
										const colorIndex = data?.competitors?.findIndex(c => c.Name === name) ?? idx;
										const colors = [
											'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'
										];
										const color = colors[colorIndex % colors.length];
										return (
											<Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 'fit-content' }}>
												<Box sx={{
													width: 12,
													height: 12,
													borderRadius: '50%',
													backgroundColor: color,
													border: `2px solid ${color}`,
													flexShrink: 0
												}} />
												<Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, whiteSpace: 'nowrap' }}>
													{name}
												</Typography>
											</Box>
										);
									})}
								</Box>
							</Box>
						</CardContent>
					</Card>
				)}

				<Typography variant="h4" component="h2" gutterBottom align="center" sx={{ mb: 4, mt: 2, fontSize: { xs: '1.5rem', sm: '2rem', md: '2.25rem' } }}>
					League Superlatives
				</Typography>

				<Box sx={{ flexGrow: 1, width: '100%' }}>
					{/* Performance & Popularity Section */}
					<Typography variant="h5" component="h3" gutterBottom align="center" sx={{ mb: 3, mt: 4, fontSize: { xs: '1.25rem', sm: '1.5rem' }, color: 'primary.main', fontWeight: 'bold' }}>
						🏆 Performance & Popularity
					</Typography>
					<Grid container spacing={3} sx={{
						width: '100%',
						margin: 0,
						justifyContent: { md: 'center' },
						mb: 4
					}}>
						{/* Most Popular */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Most Popular Overall"
									description="Received the most total votes across all submissions"
									winnerName={superlatives?.mostPopular?.competitor?.Name}
									detail={`Total Votes: ${superlatives?.mostPopular?.points}`}
									additionalCompetitors={superlatives?.mostPopular?.restOfField}
									isTied={superlatives?.mostPopular?.isTied}
									tiedWinners={superlatives?.mostPopular?.tiedWinners}
									tiedDetails={superlatives?.mostPopular?.isTied ?
										superlatives?.mostPopular?.tiedWinners?.map(name =>
											`Total Votes: ${superlatives?.mostPopular?.points}`
										) : null}
									calculationKey="mostPopular"
								/>
							</Box>
						</Grid>

						{/* Most Popular (on average) - formerly Least Popular */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Consistently Popular"
									description="Highest average votes per submission"
									winnerName={superlatives?.leastPopular?.competitor?.Name}
									detail={`Average Votes: ${superlatives?.leastPopular?.avgPoints}`}
									additionalCompetitors={superlatives?.leastPopular?.restOfField}
									isTied={superlatives?.leastPopular?.isTied}
									tiedWinners={superlatives?.leastPopular?.tiedWinners}
									tiedDetails={superlatives?.leastPopular?.isTied ?
										superlatives?.leastPopular?.tiedWinners?.map(name =>
											`Average Votes: ${superlatives?.leastPopular?.avgPoints}`
										) : null}
									calculationKey="consistentlyPopular"
								/>
							</Box>
						</Grid>

						{/* Most Average */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Most Average"
									description="Closest to the overall league average score"
									winnerName={superlatives?.mostAverage?.competitor?.Name}
									detail={`Average Votes: ${superlatives?.mostAverage?.avgPoints} (Overall Avg: ${superlatives?.mostAverage?.overallAvg})`}
									additionalCompetitors={superlatives?.mostAverage?.restOfField}
									isTied={superlatives?.mostAverage?.isTied}
									tiedWinners={superlatives?.mostAverage?.tiedWinners}
									tiedDetails={superlatives?.mostAverage?.isTied ?
										superlatives?.mostAverage?.tiedWinners?.map(name =>
											`Average Votes: ${superlatives?.mostAverage?.avgPoints} (Overall Avg: ${superlatives?.mostAverage?.overallAvg})`
										) : null}
									calculationKey="mostAverage"
								/>
							</Box>
						</Grid>

						{/* Best Performance */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Best Performance"
									description="Highest score in a single round"
									winnerName={superlatives?.bestPerformance?.competitor?.Name}
									detail={
										`Score: ${superlatives?.bestPerformance?.score} votes
								Round: "${superlatives?.bestPerformance?.round?.Name}"
								Song: "${superlatives?.bestPerformance?.songTitle}" by ${superlatives?.bestPerformance?.artist}`
									}
									additionalCompetitors={superlatives?.bestPerformance?.restOfField}
									isTied={superlatives?.bestPerformance?.isTied}
									tiedWinners={superlatives?.bestPerformance?.tiedWinners}
									tiedDetails={superlatives?.bestPerformance?.isTied ?
										superlatives?.bestPerformance?.tiedWinners?.map(winner => {
											// Extract the competitor name and song title from the format "Name ("Song")"
											const match = winner.match(/(.*) \("(.*)"\)/);
											if (match) {
												const name = match[1];
												const song = match[2];
												// Find the corresponding tied performance
												const performance = superlatives?.bestPerformance?.tiedPerformances?.find(
													p => p.competitor?.Name === name && p.songTitle === song
												);
												if (performance) {
													return `Score: ${performance.score} votes
								Round: "${performance.round?.Name}"
								Song: "${performance.songTitle}" by ${performance.artist}`;
												}
											}
											return `Score: ${superlatives?.bestPerformance?.score} votes`;
										}) : null
									}
									calculationKey="bestPerformance"
								/>
							</Box>
						</Grid>

						{/* Comeback Kid */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Comeback Kid"
									description="Biggest comeback from lowest submission to best subsequent performance"
									winnerName={superlatives?.comebackKid?.competitor?.Name}
									detail={`Comeback: +${superlatives?.comebackKid?.comebackMagnitude} points

								Lowest Performance:
								• ${superlatives?.comebackKid?.lowestScore} points in "${superlatives?.comebackKid?.lowestRound?.Name}"
								• Song: "${superlatives?.comebackKid?.lowestSubmission?.title}" by ${superlatives?.comebackKid?.lowestSubmission?.artist}

								Best Subsequent Performance:
								• ${superlatives?.comebackKid?.bestSubsequentScore} points in "${superlatives?.comebackKid?.bestRound?.Name}"
								• Song: "${superlatives?.comebackKid?.bestSubmission?.title}" by ${superlatives?.comebackKid?.bestSubmission?.artist}`}
									additionalCompetitors={superlatives?.comebackKid?.restOfField}
									isTied={superlatives?.comebackKid?.isTied}
									tiedWinners={superlatives?.comebackKid?.tiedWinners}
									tiedDetails={superlatives?.comebackKid?.isTied ?
										superlatives?.comebackKid?.tiedComebacks?.map(comeback =>
											`Comeback: +${comeback.comebackMagnitude} points

											Lowest Performance:
											• ${comeback.lowestScore} points in "${comeback.lowestRound?.Name}"
											• Song: "${comeback.lowestSubmission?.title}" by ${comeback.lowestSubmission?.artist}

											Best Subsequent Performance:
											• ${comeback.bestSubsequentScore} points in "${comeback.bestRound?.Name}"
											• Song: "${comeback.bestSubmission?.title}" by ${comeback.bestSubmission?.artist}`
										) ||
										superlatives?.comebackKid?.tiedWinners?.map(
											name => `Comeback: +${superlatives?.comebackKid?.comebackMagnitude} points`
										) : null
									}
									calculationKey="comebackKid"
								/>
							</Box>
						</Grid>
					</Grid>

					{/* Music Taste & Discovery Section */}
					<Typography variant="h5" component="h3" gutterBottom align="center" sx={{ mb: 3, mt: 4, fontSize: { xs: '1.25rem', sm: '1.5rem' }, color: 'primary.main', fontWeight: 'bold' }}>
						🎵 Music Taste & Discovery
					</Typography>
					<Grid container spacing={3} sx={{
						width: '100%',
						margin: 0,
						justifyContent: { md: 'center' },
						mb: 4
					}}>
						{/* Trend Setter */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Trend Setter"
									description="Submitted the most obscure songs based on Spotify popularity"
									winnerName={superlatives?.spotify?.trendSetter?.competitor?.Name}
									detail={`Average song popularity: ${superlatives?.spotify?.trendSetter?.avgPopularity} / 100`}
									additionalCompetitors={superlatives?.spotify?.trendSetter?.restOfField}
									isTied={superlatives?.spotify?.trendSetter?.isTied}
									tiedWinners={superlatives?.spotify?.trendSetter?.tiedWinners}
									tiedDetails={superlatives?.spotify?.trendSetter?.isTied ?
										superlatives?.spotify?.trendSetter?.tiedWinners?.map(
											name => `Average popularity: ${superlatives?.spotify?.trendSetter?.avgPopularity} / 100`
										) : null
									}
									calculationKey="trendSetter"
								/>
							</Box>
						</Grid>

						{/* Mainstream */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Mainstream"
									description="Submitted the most popular songs based on Spotify popularity"
									winnerName={superlatives?.spotify?.mainstream?.competitor?.Name}
									detail={`Average song popularity: ${superlatives?.spotify?.mainstream?.avgPopularity} / 100`}
									additionalCompetitors={superlatives?.spotify?.mainstream?.restOfField}
									isTied={superlatives?.spotify?.mainstream?.isTied}
									tiedWinners={superlatives?.spotify?.mainstream?.tiedWinners}
									tiedDetails={superlatives?.spotify?.mainstream?.isTied ?
										superlatives?.spotify?.mainstream?.tiedWinners?.map(
											name => `Average popularity: ${superlatives?.spotify?.mainstream?.avgPopularity} / 100`
										) : null
									}
									calculationKey="mainstream"
								/>
							</Box>
						</Grid>
					</Grid>

					{/* Voting Behavior Section */}
					<Typography variant="h5" component="h3" gutterBottom align="center" sx={{ mb: 3, mt: 4, fontSize: { xs: '1.25rem', sm: '1.5rem' }, color: 'primary.main', fontWeight: 'bold' }}>
						🗳️ Voting Behavior
					</Typography>
					<Grid container spacing={3} sx={{
						width: '100%',
						margin: 0,
						justifyContent: { md: 'center' },
						mb: 4
					}}>
						{/* Vote Spreader */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Vote Spreader"
									description="Distributes votes most evenly across submissions"
									winnerName={superlatives?.voteSpreader?.competitor?.Name}
									detail={`Standard Deviation: ${superlatives?.voteSpreader?.standardDeviation}
								Average Votes Given: ${superlatives?.voteSpreader?.meanPoints}
								Total Votes Cast: ${superlatives?.voteSpreader?.totalVotes}`}
									additionalCompetitors={superlatives?.voteSpreader?.restOfField}
									isTied={superlatives?.voteSpreader?.isTied}
									tiedWinners={superlatives?.voteSpreader?.tiedWinners}
									tiedDetails={superlatives?.voteSpreader?.isTied ?
										superlatives?.voteSpreader?.tiedWinners?.map(
											name => `Standard Deviation: ${superlatives?.voteSpreader?.standardDeviation}`
										) : null
									}
									calculationKey="voteSpreader"
								/>
							</Box>
						</Grid>

						{/* Single-Vote Giver */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Single-Vote Giver"
									description="Highest percentage of votes given as single points"
									winnerName={superlatives?.singleVoteGiver?.competitor?.Name}
									detail={`${superlatives?.singleVoteGiver?.singleCount} single votes (${superlatives?.singleVoteGiver?.singlePercentage}% of ${superlatives?.singleVoteGiver?.totalVotes} total votes)`}
									additionalCompetitors={superlatives?.singleVoteGiver?.restOfField}
									isTied={superlatives?.singleVoteGiver?.isTied}
									tiedWinners={superlatives?.singleVoteGiver?.tiedWinners}
									tiedDetails={superlatives?.singleVoteGiver?.isTied ?
										superlatives?.singleVoteGiver?.tiedWinners?.map(
											name => `${superlatives?.singleVoteGiver?.singleCount} single votes (${superlatives?.singleVoteGiver?.singlePercentage}% of ${superlatives?.singleVoteGiver?.totalVotes} total votes)`
										) : null
									}
									calculationKey="singleVoteGiver"
								/>
							</Box>
						</Grid>

						{/* Max-Vote Giver */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Max-Vote Giver"
									description="Most frequently put all votes on a single song in rounds"
									winnerName={superlatives?.maxVoteGiver?.competitor?.Name}
									detail={`${superlatives?.maxVoteGiver?.allInRounds}/${superlatives?.maxVoteGiver?.totalRounds} rounds (${superlatives?.maxVoteGiver?.allInPercentage}%) went all-in on one song

								Max votes given:
								${superlatives?.maxVoteGiver?.allInExamples?.map(example =>
										`• ${example.points} votes to "${example.songTitle}" by ${example.songArtist}`
									).join('\n') || 'None'}`}
									additionalCompetitors={superlatives?.maxVoteGiver?.restOfField}
									isTied={superlatives?.maxVoteGiver?.isTied}
									tiedWinners={superlatives?.maxVoteGiver?.tiedWinners}
									tiedDetails={superlatives?.maxVoteGiver?.isTied ?
										superlatives?.maxVoteGiver?.tiedWinnersData?.map(winner =>
											`${winner.allInRounds}/${winner.totalRounds} rounds (${winner.allInPercentage.toFixed(1)}%)

											Max votes given:
											${winner.allInExamples?.map(example =>
												`• ${example.points} votes to "${example.songTitle}" by ${example.songArtist}`
											).join('\n') || 'None'}`
										) : null
									}
									calculationKey="maxVoteGiver"
								/>
							</Box>
						</Grid>

						{/* Doesn't Often Vote */}
						{superlatives?.doesntVote?.competitor && (
							<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
								paddingBottom: 3,
								display: 'flex',
								justifyContent: 'center'
							}}>
								<Box sx={{ width: '100%', maxWidth: '500px' }}>
									<SuperlativeCard
										title="Doesn't Often Vote"
										description="Missed the most rounds of voting"
										winnerName={superlatives?.doesntVote?.competitor?.Name}
										detail={`${superlatives?.doesntVote?.roundsMissed}/${superlatives?.doesntVote?.totalRounds} rounds missed (${superlatives?.doesntVote?.missedPercentage}%)
								Participated in: ${superlatives?.doesntVote?.roundsParticipated} rounds`}
										additionalCompetitors={superlatives?.doesntVote?.restOfField}
										isTied={superlatives?.doesntVote?.isTied}
										tiedWinners={superlatives?.doesntVote?.tiedWinners}
										tiedDetails={superlatives?.doesntVote?.isTied ?
											superlatives?.doesntVote?.tiedWinners?.map(
												name => `${superlatives?.doesntVote?.roundsMissed}/${superlatives?.doesntVote?.totalRounds} rounds missed (${superlatives?.doesntVote?.missedPercentage}%)`
											) : null
										}
										calculationKey="doesntVote"
									/>
								</Box>
							</Grid>
						)}
					</Grid>

					{/* Timing & Participation Section */}
					<Typography variant="h5" component="h3" gutterBottom align="center" sx={{ mb: 3, mt: 4, fontSize: { xs: '1.25rem', sm: '1.5rem' }, color: 'primary.main', fontWeight: 'bold' }}>
						⏰ Timing & Participation
					</Typography>
					<Grid container spacing={3} sx={{
						width: '100%',
						margin: 0,
						justifyContent: { md: 'center' },
						mb: 4
					}}>
						{/* Early Voter */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Early Bird Voter"
									description="Most frequently voted early in rounds"
									winnerName={superlatives?.votingTiming?.earlyVoter?.competitor?.Name}
									detail={`${superlatives?.votingTiming?.earlyVoter?.earlyRounds} rounds voted early`}
									additionalCompetitors={superlatives?.votingTiming?.earlyVoter?.restOfField}
									isTied={superlatives?.votingTiming?.earlyVoter?.isTied}
									tiedWinners={superlatives?.votingTiming?.earlyVoter?.tiedWinners}
									tiedDetails={superlatives?.votingTiming?.earlyVoter?.isTied ?
										superlatives?.votingTiming?.earlyVoter?.tiedWinners?.map(
											name => `${superlatives?.votingTiming?.earlyVoter?.earlyRounds} rounds voted early`
										) : null
									}
									calculationKey="earlyVoter"
								/>
							</Box>
						</Grid>

						{/* Late Voter */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Last Minute Voter"
									description="Most frequently voted late in rounds"
									winnerName={superlatives?.votingTiming?.lateVoter?.competitor?.Name}
									detail={`${superlatives?.votingTiming?.lateVoter?.lateRounds} rounds voted late`}
									additionalCompetitors={superlatives?.votingTiming?.lateVoter?.restOfField}
									isTied={superlatives?.votingTiming?.lateVoter?.isTied}
									tiedWinners={superlatives?.votingTiming?.lateVoter?.tiedWinners}
									tiedDetails={superlatives?.votingTiming?.lateVoter?.isTied ?
										superlatives?.votingTiming?.lateVoter?.tiedWinners?.map(
											name => `${superlatives?.votingTiming?.lateVoter?.lateRounds} rounds voted late`
										) : null
									}
									calculationKey="lateVoter"
								/>
							</Box>
						</Grid>

						{/* Early Bird Submitter */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Early Bird Submitter"
									description="Submits early and still lands high scores"
									winnerName={earlyBirdData?.competitor?.Name}
									detail={formatTimingDetail('Early Bird', earlyBirdData)}
									additionalCompetitors={earlyBirdData?.restOfField}
									isTied={earlyBirdData?.isTied}
									tiedWinners={earlyBirdData?.tiedWinners}
									tiedDetails={earlyBirdData?.tiedDetails}
									calculationKey="earlyBird"
								/>
							</Box>
						</Grid>

						{/* Last Minute Submitter */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Last Minute Submitter"
									description="Submits late but still crushes the round"
									winnerName={lastMinuteData?.competitor?.Name}
									detail={formatTimingDetail('Last Minute', lastMinuteData)}
									additionalCompetitors={lastMinuteData?.restOfField}
									isTied={lastMinuteData?.isTied}
									tiedWinners={lastMinuteData?.tiedWinners}
									tiedDetails={lastMinuteData?.tiedDetails}
									calculationKey="lastMinute"
								/>
							</Box>
						</Grid>
					</Grid>
					{/* Comments & Engagement Section */}
					<Typography variant="h5" component="h3" gutterBottom align="center" sx={{ mb: 3, mt: 4, fontSize: { xs: '1.25rem', sm: '1.5rem' }, color: 'primary.main', fontWeight: 'bold' }}>
						💬 Comments & Engagement
					</Typography>
					<Grid container spacing={3} sx={{
						width: '100%',
						margin: 0,
						justifyContent: { md: 'center' },
						mb: 4
					}}>
						{/* Longest Comment */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Longest Comment"
									description="Left the most verbose feedback"
									winnerName={superlatives?.longestComment?.competitor?.Name}
									detail={`${superlatives?.longestComment?.commentLength} characters: "${superlatives?.longestComment?.comment}"`}
									additionalCompetitors={superlatives?.longestComment?.restOfField}
									isTied={superlatives?.longestComment?.isTied}
									tiedWinners={superlatives?.longestComment?.tiedWinners}
									tiedDetails={superlatives?.longestComment?.isTied ?
										superlatives?.longestComment?.tiedComments?.map(
											c => `${c.commentLength} characters: "${c.comment}"`
										) ||
										superlatives?.longestComment?.tiedWinners?.map(
											name => `${superlatives?.longestComment?.commentLength} characters`
										) : null
									}
									calculationKey="longestComment"
								/>
							</Box>
						</Grid>

						{/* Most Comments */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Most Comments Given"
									description="Left the most comments when voting"
									winnerName={superlatives?.mostComments?.competitor?.Name}
									detail={`${superlatives?.mostComments?.commentCount} comments`}
									additionalCompetitors={superlatives?.mostComments?.restOfField}
									isTied={superlatives?.mostComments?.isTied}
									tiedWinners={superlatives?.mostComments?.tiedWinners}
									tiedDetails={superlatives?.mostComments?.isTied ?
										superlatives?.mostComments?.tiedWinners?.map(
											name => `${superlatives?.mostComments?.commentCount} comments`
										) : null
									}
									calculationKey="mostComments"
								/>
							</Box>
						</Grid>
					</Grid>

					{/* Relationships & Compatibility Section */}
					<Typography variant="h5" component="h3" gutterBottom align="center" sx={{ mb: 3, mt: 4, fontSize: { xs: '1.25rem', sm: '1.5rem' }, color: 'primary.main', fontWeight: 'bold' }}>
						🤝 Relationships & Compatibility
					</Typography>
					<Grid container spacing={3} sx={{
						width: '100%',
						margin: 0,
						justifyContent: { md: 'center' },
						mb: 4
					}}>
						{/* Most Compatible */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Most Compatible"
									description="Pair who consistently gave each other high votes"
									winnerName={`${superlatives?.compatibility?.mostCompatible?.competitor1?.Name} & ${superlatives?.compatibility?.mostCompatible?.competitor2?.Name}`}
									detail={`Compatibility Score: ${superlatives?.compatibility?.mostCompatible?.score}
								${superlatives?.compatibility?.mostCompatible?.competitor1?.Name} → ${superlatives?.compatibility?.mostCompatible?.competitor2?.Name}: ${superlatives?.compatibility?.mostCompatible?.avgAToB} avg votes
								${superlatives?.compatibility?.mostCompatible?.competitor2?.Name} → ${superlatives?.compatibility?.mostCompatible?.competitor1?.Name}: ${superlatives?.compatibility?.mostCompatible?.avgBToA} avg votes`}
									additionalCompetitors={superlatives?.compatibility?.mostCompatible?.restOfField}
									isTied={superlatives?.compatibility?.mostCompatible?.isTied}
									tiedWinners={superlatives?.compatibility?.mostCompatible?.tiedWinners}
									tiedDetails={superlatives?.compatibility?.mostCompatible?.isTied ?
										superlatives?.compatibility?.mostCompatible?.tiedPairs?.map(pair =>
											`Compatibility Score: ${pair.score}
								${pair.competitor1.Name} → ${pair.competitor2.Name}: ${pair.avgAToB} avg votes
								${pair.competitor2.Name} → ${pair.competitor1.Name}: ${pair.avgBToA} avg votes`
										) ||
										superlatives?.compatibility?.mostCompatible?.tiedWinners?.map(
											name => `Compatibility Score: ${superlatives?.compatibility?.mostCompatible?.score}`
										) : null
									}
									calculationKey="mostCompatible"
								/>
							</Box>
						</Grid>

						{/* Least Compatible */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Least Compatible"
									description="Pair who consistently gave each other low votes"
									winnerName={`${superlatives?.compatibility?.leastCompatible?.competitor1?.Name} & ${superlatives?.compatibility?.leastCompatible?.competitor2?.Name}`}
									detail={`Compatibility Score: ${superlatives?.compatibility?.leastCompatible?.score}
								${superlatives?.compatibility?.leastCompatible?.competitor1?.Name} → ${superlatives?.compatibility?.leastCompatible?.competitor2?.Name}: ${superlatives?.compatibility?.leastCompatible?.avgAToB} avg votes
								${superlatives?.compatibility?.leastCompatible?.competitor2?.Name} → ${superlatives?.compatibility?.leastCompatible?.competitor1?.Name}: ${superlatives?.compatibility?.leastCompatible?.avgBToA} avg votes`}
									additionalCompetitors={superlatives?.compatibility?.leastCompatible?.restOfField}
									isTied={superlatives?.compatibility?.leastCompatible?.isTied}
									tiedWinners={superlatives?.compatibility?.leastCompatible?.tiedWinners}
									tiedDetails={superlatives?.compatibility?.leastCompatible?.isTied ?
										superlatives?.compatibility?.leastCompatible?.tiedPairs?.map(pair =>
											`Compatibility Score: ${pair.score}
								${pair.competitor1.Name} → ${pair.competitor2.Name}: ${pair.avgAToB} avg votes
								${pair.competitor2.Name} → ${pair.competitor1.Name}: ${pair.avgBToA} avg votes`
										) ||
										superlatives?.compatibility?.leastCompatible?.tiedWinners?.map(
											name => `Compatibility Score: ${superlatives?.compatibility?.leastCompatible?.score}`
										) : null
									}
									calculationKey="leastCompatible"
								/>
							</Box>
						</Grid>

						{/* Most Similar */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Most Similar Taste"
									description="Pair who voted most similarly across songs"
									winnerName={`${superlatives?.similarity?.mostSimilar?.competitor1?.Name} & ${superlatives?.similarity?.mostSimilar?.competitor2?.Name}`}
									detail={`Similarity Score: ${superlatives?.similarity?.mostSimilar?.score}
								Average Difference: ${superlatives?.similarity?.mostSimilar?.avgDiff ?? 'N/A'} votes
								Common Songs Voted On: ${superlatives?.similarity?.mostSimilar?.votesCompared ?? 'N/A'}`}
									additionalCompetitors={superlatives?.similarity?.mostSimilar?.restOfField}
									isTied={superlatives?.similarity?.mostSimilar?.isTied}
									tiedWinners={superlatives?.similarity?.mostSimilar?.tiedWinners}
									tiedDetails={superlatives?.similarity?.mostSimilar?.isTied ?
										superlatives?.similarity?.mostSimilar?.tiedPairs?.map(pair =>
											`Similarity Score: ${pair.score}
								Average Difference: ${pair.avgDiff ?? 'N/A'} votes
								Common Songs Voted On: ${pair.votesCompared ?? 'N/A'}`
										) ||
										superlatives?.similarity?.mostSimilar?.tiedWinners?.map(
											name => `Similarity Score: ${superlatives?.similarity?.mostSimilar?.score}`
										) : null
									}
									calculationKey="mostSimilar"
								/>
							</Box>
						</Grid>

						{/* Least Similar */}
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Most Different Taste"
									description="Pair who voted most differently across songs"
									winnerName={`${superlatives?.similarity?.leastSimilar?.competitor1?.Name} & ${superlatives?.similarity?.leastSimilar?.competitor2?.Name}`}
									detail={`Similarity Score: ${superlatives?.similarity?.leastSimilar?.score}
								Average Difference: ${superlatives?.similarity?.leastSimilar?.avgDiff ?? 'N/A'} votes
								Common Songs Voted On: ${superlatives?.similarity?.leastSimilar?.votesCompared ?? 'N/A'}`}
									additionalCompetitors={superlatives?.similarity?.leastSimilar?.restOfField}
									isTied={superlatives?.similarity?.leastSimilar?.isTied}
									tiedWinners={superlatives?.similarity?.leastSimilar?.tiedWinners}
									tiedDetails={superlatives?.similarity?.leastSimilar?.isTied ?
										superlatives?.similarity?.leastSimilar?.tiedPairs?.map(pair =>
											`Similarity Score: ${pair.score}
								Average Difference: ${pair.avgDiff ?? 'N/A'} votes
								Common Songs Voted On: ${pair.votesCompared ?? 'N/A'}`
										) ||
										superlatives?.similarity?.leastSimilar?.tiedWinners?.map(
											name => `Similarity Score: ${superlatives?.similarity?.leastSimilar?.score}`
										) : null
									}
									calculationKey="leastSimilar"
								/>
							</Box>
						</Grid>
					</Grid>
				</Box>
			</TabPanel>

			{/* Individual Performance Tab */}
			<TabPanel value={tabValue} index={1}>
				<IndividualPerformance data={data} season={season} />
			</TabPanel>

			{/* Round Details Modal */}
			<Modal
				open={modalOpen}
				onClose={handleModalClose}
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					p: 2
				}}
			>
				<Paper sx={{
					backgroundColor: 'white',
					border: `2px solid ${theme.palette.primary.main}`,
					borderRadius: 2,
					p: 3,
					maxWidth: { xs: '90vw', sm: '600px' },
					maxHeight: { xs: '80vh', sm: '70vh' },
					overflowY: 'auto',
					outline: 'none',
					'&::-webkit-scrollbar': {
						width: '8px',
					},
					'&::-webkit-scrollbar-track': {
						backgroundColor: 'rgba(0,0,0,0.05)',
						borderRadius: '10px',
					},
					'&::-webkit-scrollbar-thumb': {
						backgroundColor: 'rgba(0,0,0,0.2)',
						borderRadius: '10px',
					}
				}}>
					{selectedRound && (
						<>
							<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
								<Typography variant="h5" sx={{
									fontWeight: 'bold',
									color: theme.palette.primary.main
								}}>
									{(() => {
										const roundNumber = selectedRound.roundNumber;
										const currentRound = data.rounds?.[roundNumber - 1];
										return currentRound?.Name || `Round ${roundNumber}`;
									})()}
								</Typography>
								<IconButton onClick={handleModalClose} size="small">
									<Close />
								</IconButton>
							</Box>

							{(() => {
								const roundNumber = selectedRound.roundNumber;
								const currentRound = data.rounds?.[roundNumber - 1];

								// Create a map of competitor submissions for this round
								const roundSubmissions = {};
								data.submissions?.forEach(submission => {
									if (submission['Round ID'] === currentRound?.ID) {
										const competitorId = submission['Submitter ID'];
										const competitor = data.competitors?.find(c => c.ID === competitorId);
										if (competitor) {
											roundSubmissions[competitor.Name] = {
												title: submission.Title,
												artist: submission['Artist(s)']
											};
										}
									}
								});

								const competitors = selectedRound.roundData
									?.filter(entry => entry.value !== null)
									?.sort((a, b) => (b.value || 0) - (a.value || 0)) || [];

								return (
									<Box>
										{competitors.map((entry, index) => {
											const competitorName = entry.dataKey;
											const submission = roundSubmissions[competitorName];
											const colors = [
												'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'
											];
											const competitorIndex = data.competitors?.findIndex(c => c.Name === competitorName) || 0;
											const color = colors[competitorIndex % colors.length];

											return (
												<Box key={index} sx={{
													mb: 2.5,
													pb: 2,
													borderBottom: index < competitors.length - 1 ? '1px solid #eee' : 'none',
													display: 'flex',
													alignItems: 'flex-start',
													gap: 1
												}}>
													<Box
														sx={{
															width: 16,
															height: 16,
															borderRadius: '50%',
															backgroundColor: color,
															border: `2px solid ${color}`,
															flexShrink: 0,
															mt: 0.25
														}}
													/>
													<Box sx={{ flexGrow: 1 }}>
														<Typography
															variant="h6"
															sx={{
																fontSize: '1rem',
																fontWeight: 'bold',
																color: color,
																mb: 0.5
															}}
														>
															{competitorName}: {entry.value} votes
														</Typography>
														{submission ? (
															<Typography
																variant="body2"
																sx={{
																	color: 'text.primary',
																	mb: 0.25
																}}
															>
																<strong>"{submission.title}"</strong>
															</Typography>
														) : (
															<Typography
																variant="body2"
																sx={{
																	color: 'text.secondary',
																	fontStyle: 'italic'
																}}
															>
																No submission
															</Typography>
														)}
														{submission && (
															<Typography
																variant="body2"
																sx={{
																	color: 'text.secondary'
																}}
															>
																by {submission.artist}
															</Typography>
														)}
													</Box>
												</Box>
											);
										})}
									</Box>
								);
							})()}
						</>
					)}
				</Paper>
			</Modal>
		</Container>
	);
};

export default DashboardContent; 