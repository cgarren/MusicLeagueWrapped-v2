import React, { useState } from 'react';
import { Container, Typography, Grid, Box, Tabs, Tab, useMediaQuery, useTheme, Card, CardContent, Paper, Modal, IconButton, Accordion, AccordionSummary, AccordionDetails, ToggleButtonGroup, ToggleButton, Collapse, Button } from '@mui/material';
import { Close } from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine, LabelList } from 'recharts';

// Individual award components
import SuperlativeCard from './SuperlativeCard';
import VotingGraph from './VotingGraph';
import IndividualPerformance from './IndividualPerformance';

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

	const formatNumber = (value, digits = 2) => {
		if (value === null || value === undefined || Number.isNaN(value)) {
			return 'N/A';
		}
		return Number(value).toFixed(digits);
	};

	const formatPValue = (value) => {
		if (value === null || value === undefined || Number.isNaN(value)) {
			return 'N/A';
		}
		if (value < 0.001) return '< 0.001';
		return value.toFixed(3);
	};

	const submissionTiming = superlatives?.submissionTiming;
	const hasTimingData = submissionTiming?.submissionRecords?.length >= 3;
	const timingOverall = submissionTiming?.overall;
	const timingTrendDescription = (() => {
		if (!timingOverall) return null;
		if (timingOverall.direction === 'earlier-better') {
			return 'Earlier submissions tended to earn more votes.';
		}
		if (timingOverall.direction === 'later-better') {
			return 'Later submissions tended to earn more votes.';
		}
		if (timingOverall.direction === 'neutral') {
			return 'Submission timing did not show a strong league-wide trend.';
		}
		return 'Not enough data to evaluate submission timing.';
	})();
	const timingAdditionalCompetitors = (() => {
		if (!submissionTiming?.rankedCompetitors?.length) return [];
		return submissionTiming.rankedCompetitors
			.slice(1, 4)
			.filter((stat) => stat?.competitor?.Name)
			.map((stat) => {
				const early = formatNumber(stat.earlyAvgVotes, 1);
				const late = formatNumber(stat.lateAvgVotes, 1);
				return {
					name: stat.competitor.Name,
					score: `Early avg: ${early} vs Late avg: ${late} (corr ${formatNumber(stat.coefficient, 2)})`
				};
			});
	})();
	const timingWinnerDetail = (() => {
		const stat = submissionTiming?.bestCompetitor;
		if (!stat || !stat.competitor) {
			return 'Not enough data to evaluate timing impact for individual competitors.';
		}
		const early = formatNumber(stat.earlyAvgVotes, 1);
		const late = formatNumber(stat.lateAvgVotes, 1);
		const corr = formatNumber(stat.coefficient, 2);
		const pVal = formatPValue(stat.pValue);
		const directionText =
			stat.direction === 'earlier-better'
				? 'Performed best when submitting earlier in the round.'
				: stat.direction === 'later-better'
					? 'Performed best when submitting later in the round.'
					: 'Displayed a balanced timing pattern.';
		return `Correlation (order vs votes): ${corr}
p-value: ${pVal}
Early avg votes: ${early}
Late avg votes: ${late}
${directionText}`;
	})();
	const timingSummaryStats = timingOverall
		? {
			coefficient: formatNumber(timingOverall.coefficient, 2),
			pValue: formatPValue(timingOverall.pValue),
			earlyAvg: formatNumber(timingOverall.earlyAvgVotes, 1),
			lateAvg: formatNumber(timingOverall.lateAvgVotes, 1)
		}
		: null;

	// State for round details modal
	const [selectedRound, setSelectedRound] = useState(null);
	const [modalOpen, setModalOpen] = useState(false);

	// Fullscreen chart modal state
	const [fullscreenOpen, setFullscreenOpen] = useState(false);
	const [fullscreenChart, setFullscreenChart] = useState(null); // 'scatter' | 'lineRound' | 'lineCumulative'

	// State for chart tabs
	const [chartTabValue, setChartTabValue] = useState(0);

	// Focus mode for line charts (Top 5 vs All)
	const [lineFocusMode, setLineFocusMode] = useState('all');
	// Focused competitor highlight
	const [focusedCompetitorName, setFocusedCompetitorName] = useState(null);
	// Collapsible descriptions
	const [showMoreScatter, setShowMoreScatter] = useState(false);
	const [showMorePerformance, setShowMorePerformance] = useState(false);

	// Interaction state for performance charts

	// XS-only filter for scatter
	const [showTop20, setShowTop20] = useState(false);

	// Deterministic jitter helper to reduce point stacking on popularity axis
	const getDeterministicJitter = (key, scale = 1) => {
		if (!key) return 0;
		let hash = 0;
		for (let i = 0; i < key.length; i++) {
			hash = ((hash << 5) - hash) + key.charCodeAt(i);
			hash |= 0;
		}
		const normalized = (Math.abs(hash) % 1000) / 1000; // 0..1
		return (normalized * 2 - 1) * scale; // -scale..+scale
	};
	const handleRoundClick = (roundData, roundNumber) => {
		setSelectedRound({ roundData, roundNumber });
		setModalOpen(true);
	};

	const handleModalClose = () => {
		setModalOpen(false);
		setSelectedRound(null);
	};



	const closeFullscreen = () => {
		setFullscreenOpen(false);
		setFullscreenChart(null);
	};

	const handleChartTabChange = (event, newValue) => {
		setChartTabValue(newValue);
	};

	const handleLineFocusChange = (event, newValue) => {
		if (newValue) setLineFocusMode(newValue);
	};

	const handleFocusToggle = (name) => {
		setFocusedCompetitorName(prev => (prev === name ? null : name));
	};

	const clearFocus = () => setFocusedCompetitorName(null);

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
		const maxRounds = data.rounds.length;

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

	// Helper: get filtered competitor list (all competitors shown; Top N control removed)
	const getFilteredCompetitors = (chartData) => {
		const names = (data?.competitors || [])
			.filter(c => c && c.Name)
			.map(c => c.Name);
		return new Set(names);
	};

	// Compute Top N competitors by cumulative total (for focus mode)
	const getTopNCompetitorNames = (n = 5) => {
		const cumulativeData = generatePerformanceData(true);
		if (!cumulativeData?.length) return [];
		const lastRound = cumulativeData[cumulativeData.length - 1];
		const entries = Object.entries(lastRound)
			.filter(([key]) => key !== 'round' && typeof lastRound[key] === 'number');
		return entries
			.sort((a, b) => b[1] - a[1])
			.slice(0, n)
			.map(([name]) => name);
	};

	//

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
					overflowX: 'auto',
					position: 'relative'
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
							<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<Typography variant="h5" component="h2" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold', mb: 1 }}>
									🎵 League Songs: Performance vs Spotify Popularity
								</Typography>
							</Box>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
								{isSmallScreen ? (showMoreScatter ? 'How popular was the music you submitted? Each point represents a song colored by its submitter.' : 'How popular was the music you submitted?') : 'How popular was the music you submitted? Each point represents a song colored by its submitter.'}
							</Typography>
							{isSmallScreen && (
								<Button size="small" onClick={() => setShowMoreScatter(v => !v)} sx={{ mb: 2 }}>
									{showMoreScatter ? 'Less' : 'More'}
								</Button>
							)}
							<Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1, mb: 2 }}>
								<ToggleButton size="small" value="top20" selected={showTop20} onChange={() => setShowTop20(v => !v)}>
									Top 20 by votes
								</ToggleButton>
							</Box>
							<Box sx={{ overflowX: 'auto', pb: 1 }}>
								<Box sx={{ width: '100%', minWidth: { xs: 720, sm: '100%' }, height: { xs: 420, sm: 450, md: 500 }, minHeight: { xs: 360, sm: 400 } }}>
									<ResponsiveContainer width="100%" height="100%">
										<ScatterChart
											margin={{
												top: 20,
												right: isMediumScreen ? 20 : 80,
												bottom: isMediumScreen ? 40 : 60,
												left: isMediumScreen ? 10 : 20,
											}}
										>
											<CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={isSmallScreen ? 0.2 : 0.3} />
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
													style: { textAnchor: 'middle', fill: theme.palette.text.primary, fontSize: isMediumScreen ? '12px' : '14px', fontWeight: 'bold' }
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
													style: { textAnchor: 'middle', fill: theme.palette.text.primary, fontSize: isMediumScreen ? '12px' : '14px', fontWeight: 'bold' }
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

													// Build scatter dataset with jitter and optional filters
													let points = data.submissions
														.filter(sub => sub.popularity !== null && sub.popularity !== undefined)
														.map(sub => {
															const votes = submissionVotes[sub['Spotify URI']] || 0;
															const relativePerformance = voteRange > 0 ? (votes - minVotes) / voteRange : 0.5;
															const submitter = data.competitors.find(comp => comp.ID === sub['Submitter ID']);
															const round = data.rounds.find(r => r.ID === sub['Round ID']);
															const jitter = getDeterministicJitter(sub['Spotify URI'], 1.2);
															const x = Math.max(0, Math.min(100, (sub.popularity || 0) + jitter));
															return {
																x,
																y: relativePerformance,
																title: sub.Title,
																artist: sub['Artist(s)'],
																submitter: submitter?.Name || 'Unknown',
																roundName: round?.Name || 'Unknown',
																votes: votes,
																submitterId: sub['Submitter ID']
															};
														});

													if (showTop20) {
														points = points.sort((a, b) => b.votes - a.votes).slice(0, 20);
													}

													return points;
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
															<Cell key={`cell-${index}`} fill={colors[colorIndex]} fillOpacity={0.7} stroke={colors[colorIndex]} strokeWidth={isSmallScreen ? 1.2 : 1.8} r={isSmallScreen ? 4 : 5} />
														);
													});
												})()}
											</Scatter>
											{(() => {
												if (!data?.submissions || !data?.votes) return null;
												const submissionVotes = {};
												data.votes.forEach(v => { const uri = v['Spotify URI']; submissionVotes[uri] = (submissionVotes[uri] || 0) + parseInt(v['Points Assigned'] || 0); });
												const totals = Object.values(submissionVotes);
												const max = Math.max(...totals); const min = Math.min(...totals); const range = max - min;
												let pts = data.submissions.filter(s => s.popularity != null).map(s => {
													const votes = submissionVotes[s['Spotify URI']] || 0;
													const y = range > 0 ? (votes - min) / range : 0.5;
													const jitter = getDeterministicJitter(s['Spotify URI'], 1.2);
													const x = Math.max(0, Math.min(100, (s.popularity || 0) + jitter));
													return { x, y, votes };
												});
												if (showTop20) pts = pts.sort((a, b) => b.votes - a.votes).slice(0, 20);
												if (pts.length < 2) return null;
												let n = pts.length, sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, minX = 100, maxX = 0;
												pts.forEach(p => { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); });
												const denom = (n * sumXX - sumX * sumX);
												if (!denom) return null;
												const slope = (n * sumXY - sumX * sumY) / denom;
												const intercept = (sumY - slope * sumX) / n;
												const y0 = Math.max(0, Math.min(1, slope * minX + intercept));
												const y1 = Math.max(0, Math.min(1, slope * maxX + intercept));
												return <ReferenceLine key="scatter-trend" segment={[{ x: minX, y: y0 }, { x: maxX, y: y1 }]} stroke={theme.palette.text.secondary} strokeDasharray="6 6" />;
											})()}
										</ScatterChart>
									</ResponsiveContainer>
								</Box>
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
							{isSmallScreen ? (
								<Accordion sx={{ mt: 2 }}>
									<AccordionSummary expandIcon={<ExpandMoreIcon />}>
										<Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Competitor Legend</Typography>
									</AccordionSummary>
									<AccordionDetails>
										<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
											{(() => {
												const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'];
												return data?.competitors?.map((competitor, index) => {
													if (!competitor || !competitor.Name) return null;
													const colorIndex = index % colors.length;
													return (
														<Box key={competitor.ID || index} onClick={() => handleFocusToggle(competitor.Name)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 'fit-content', cursor: 'pointer', opacity: !focusedCompetitorName || focusedCompetitorName === competitor.Name ? 1 : 0.4 }}>
															<Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: colors[colorIndex], border: `2px solid ${colors[colorIndex]}`, flexShrink: 0 }} />
															<Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, whiteSpace: 'nowrap' }}>{competitor.Name}</Typography>
														</Box>
													);
												}).filter(Boolean);
											})()}
										</Box>
									</AccordionDetails>
								</Accordion>
							) : (
								<Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
									<Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
										Competitor Legend:
									</Typography>
									<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
										{(() => {
											const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'];
											return data?.competitors?.map((competitor, index) => {
												if (!competitor || !competitor.Name) return null;
												const colorIndex = index % colors.length;
												return (
													<Box key={competitor.ID || index} onClick={() => handleFocusToggle(competitor.Name)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 'fit-content', cursor: 'pointer', opacity: !focusedCompetitorName || focusedCompetitorName === competitor.Name ? 1 : 0.4 }}>
														<Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: colors[colorIndex], border: `2px solid ${colors[colorIndex]}`, flexShrink: 0 }} />
														<Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, whiteSpace: 'nowrap' }}>{competitor.Name}</Typography>
													</Box>
												);
											}).filter(Boolean);
										})()}
									</Box>
								</Box>
							)}
						</CardContent>
					</Card>
				</Box>

				{/* Performance Over Time Line Chart */}
				<Box sx={{ mb: 6, width: '100%' }}>
					<Card>
						<CardContent>
							<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<Typography variant="h5" component="h2" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold', mb: 1 }}>
									📈 Performance Over Time
								</Typography>
							</Box>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
								{isSmallScreen ? (showMorePerformance ? 'Track how each competitor\'s performance evolved throughout the season. Switch between round-by-round votes and cumulative totals.' : 'Track performance over the season.') : 'Track how each competitor\'s performance evolved throughout the season. Switch between round-by-round votes and cumulative totals.'}
							</Typography>
							{isSmallScreen && (
								<Button size="small" onClick={() => setShowMorePerformance(v => !v)} sx={{ mb: 2 }}>
									{showMorePerformance ? 'Less' : 'More'}
								</Button>
							)}

							{/* Chart Tabs and Focus Mode */}
							<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, position: isSmallScreen ? 'sticky' : 'static', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>
								<Tabs value={chartTabValue} onChange={handleChartTabChange} aria-label="chart tabs">
									<Tab label="Total Votes" {...a11yProps(0)} />
									<Tab label="Round-by-Round Votes" {...a11yProps(1)} />
								</Tabs>
								<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
									<ToggleButtonGroup size="small" value={lineFocusMode} exclusive onChange={handleLineFocusChange} aria-label="focus mode">
										<ToggleButton value="all">All</ToggleButton>
										<ToggleButton value="top5">Top 5</ToggleButton>
									</ToggleButtonGroup>
									{focusedCompetitorName && (
										<Button size="small" onClick={clearFocus}>Clear focus</Button>
									)}
								</Box>
							</Box>

							{/* Chart Tab Panels */}
							<TabPanel value={chartTabValue} index={1}>
								<Box sx={{ overflowX: 'auto', pb: 1 }}>
									<Box sx={{ width: '100%', minWidth: { xs: 720, sm: '100%' }, height: { xs: 420, sm: 450, md: 500 }, minHeight: { xs: 360, sm: 400 } }}>
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
												<CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={isSmallScreen ? 0.2 : 0.3} />
												<XAxis dataKey="round" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }} label={{ value: 'Round', position: 'insideBottom', offset: isMediumScreen ? -5 : -10, style: { textAnchor: 'middle', fill: theme.palette.text.primary, fontSize: isMediumScreen ? '12px' : '14px', fontWeight: 'bold' } }} />
												<YAxis tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }} label={{ value: 'Votes Received', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: theme.palette.text.primary, fontSize: isMediumScreen ? '12px' : '14px', fontWeight: 'bold' } }} />
												<Tooltip content={({ active, payload, label }) => {
													if (active && payload && payload.length) {
														const hasData = payload.some(entry => entry.value !== null);
														if (!hasData) return null;

														// Get round info
														const rn = (typeof label === 'number' && label > 0) ? label : (selectedRound?.roundNumber ?? 1);
														const currentRound = data.rounds?.[rn - 1];

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
																	{(() => {
																		const rn = (typeof label === 'number' && label > 0) ? label : (selectedRound?.roundNumber ?? 1);
																		const currentRound = data.rounds?.[rn - 1];
																		return currentRound?.Name || `Round ${rn}`;
																	})()}
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
												}} />
												{(() => {
													const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'];
													const chartData = generatePerformanceData(false);
													const visibleSet = getFilteredCompetitors(chartData);
													const topNames = lineFocusMode === 'top5' ? new Set(getTopNCompetitorNames(5)) : null;
													return data?.competitors?.map((competitor, index) => {
														if (!competitor || !competitor.Name) return null;
														const colorIndex = index % colors.length;
														const name = competitor.Name;
														if (!visibleSet.has(name)) return null;
														if (topNames && !topNames.has(name)) return null;
														const isDimmed = focusedCompetitorName && focusedCompetitorName !== name;
														return (
															<Line key={competitor.ID || index} type="linear" dataKey={name} stroke={colors[colorIndex]} strokeWidth={isDimmed ? 1 : (isSmallScreen ? 1.6 : 1.8)} strokeOpacity={isDimmed ? 0.15 : 1} dot={false} connectNulls={false} activeDot={{ r: isSmallScreen ? 7 : 5, strokeWidth: 2 }} />
														);
													}).filter(Boolean);
												})()}
											</LineChart>
										</ResponsiveContainer>
									</Box>
								</Box>
							</TabPanel>

							<TabPanel value={chartTabValue} index={0}>
								<Box sx={{ overflowX: 'auto', pb: 1 }}>
									<Box sx={{ width: '100%', minWidth: { xs: 720, sm: '100%' }, height: { xs: 420, sm: 450, md: 500 }, minHeight: { xs: 360, sm: 400 } }}>
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
												<CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={isSmallScreen ? 0.2 : 0.3} />
												<XAxis dataKey="round" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }} label={{ value: 'Round', position: 'insideBottom', offset: isMediumScreen ? -5 : -10, style: { textAnchor: 'middle', fill: theme.palette.text.primary, fontSize: isMediumScreen ? '12px' : '14px', fontWeight: 'bold' } }} />
												<YAxis tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }} label={{ value: 'Total Votes Received', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: theme.palette.text.primary, fontSize: isMediumScreen ? '12px' : '14px', fontWeight: 'bold' } }} />
												<Tooltip content={({ active, payload, label }) => {
													if (active && payload && payload.length) {
														const hasData = payload.some(entry => entry.value !== null && entry.value !== undefined);
														if (!hasData) return null;

														// Get round info
														const rn = (typeof label === 'number' && label > 0) ? label : (selectedRound?.roundNumber ?? 1);
														const currentRound = data.rounds?.[rn - 1];

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
																	{(() => {
																		const rn = (typeof label === 'number' && label > 0) ? label : (selectedRound?.roundNumber ?? 1);
																		const currentRound = data.rounds?.[rn - 1];
																		return currentRound?.Name || `Round ${rn}`;
																	})()}
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
												}} />
												{(() => {
													const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'];
													const chartData = generatePerformanceData(true);
													const visibleSet = getFilteredCompetitors(chartData);
													const topNames = lineFocusMode === 'top5' ? new Set(getTopNCompetitorNames(5)) : null;
													return data?.competitors?.map((competitor, index) => {
														if (!competitor || !competitor.Name) return null;
														const colorIndex = index % colors.length;
														const name = competitor.Name;
														if (!visibleSet.has(name)) return null;
														if (topNames && !topNames.has(name)) return null;
														const isDimmed = focusedCompetitorName && focusedCompetitorName !== name;
														return (
															<Line key={competitor.ID || index} type="linear" dataKey={name} stroke={colors[colorIndex]} strokeWidth={isDimmed ? 1 : (isSmallScreen ? 1.6 : 1.8)} strokeOpacity={isDimmed ? 0.15 : 1} dot={false} connectNulls={true} activeDot={{ r: isSmallScreen ? 7 : 5, strokeWidth: 2 }} />
														);
													}).filter(Boolean);
												})()}
											</LineChart>
										</ResponsiveContainer>
									</Box>
								</Box>
							</TabPanel>
							<Typography variant="body2" color="text.secondary" sx={{
								mt: 2,
								fontStyle: 'italic',
								fontSize: { xs: '0.75rem', sm: '0.875rem' }
							}}>
								{chartTabValue === 1 ?
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
							{isSmallScreen ? (
								<Accordion sx={{ mt: 2 }}>
									<AccordionSummary expandIcon={<ExpandMoreIcon />}>
										<Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Competitor Legend</Typography>
									</AccordionSummary>
									<AccordionDetails>
										<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
											{(() => {
												const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'];
												return data?.competitors?.map((competitor, index) => {
													if (!competitor || !competitor.Name) return null;
													const colorIndex = index % colors.length;
													return (
														<Box key={competitor.ID || index} onClick={() => handleFocusToggle(competitor.Name)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 'fit-content', cursor: 'pointer', opacity: !focusedCompetitorName || focusedCompetitorName === competitor.Name ? 1 : 0.4 }}>
															<Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: colors[colorIndex], border: `2px solid ${colors[colorIndex]}`, flexShrink: 0 }} />
															<Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, whiteSpace: 'nowrap' }}>{competitor.Name}</Typography>
														</Box>
													);
												}).filter(Boolean);
											})()}
										</Box>
									</AccordionDetails>
								</Accordion>
							) : (
								<Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
									<Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
										Competitor Legend:
									</Typography>
									<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
										{(() => {
											const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'];
											return data?.competitors?.map((competitor, index) => {
												if (!competitor || !competitor.Name) return null;
												const colorIndex = index % colors.length;
												return (
													<Box key={competitor.ID || index} onClick={() => handleFocusToggle(competitor.Name)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 'fit-content', cursor: 'pointer', opacity: !focusedCompetitorName || focusedCompetitorName === competitor.Name ? 1 : 0.4 }}>
														<Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: colors[colorIndex], border: `2px solid ${colors[colorIndex]}`, flexShrink: 0 }} />
														<Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, whiteSpace: 'nowrap' }}>{competitor.Name}</Typography>
													</Box>
												);
											}).filter(Boolean);
										})()}
									</Box>
								</Box>
							)}
						</CardContent>
					</Card>
				</Box>

				{hasTimingData && (
					<Box sx={{ mb: 6, width: '100%' }}>
						<Card>
							<CardContent>
								<Typography
									variant="h5"
									component="h2"
									gutterBottom
									sx={{ color: theme.palette.primary.main, fontWeight: 'bold', mb: 1 }}
								>
									⏱ Submission Timing vs Votes
								</Typography>
								{timingTrendDescription && (
									<Typography variant="body2" sx={{ mb: 1 }}>
										{timingTrendDescription}
									</Typography>
								)}
								{timingSummaryStats && (
									<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
										Correlation: {timingSummaryStats.coefficient} (p {timingSummaryStats.pValue}) •
										Early avg votes: {timingSummaryStats.earlyAvg} • Late avg votes: {timingSummaryStats.lateAvg}
									</Typography>
								)}
								<Box sx={{ width: '100%', height: { xs: 420, sm: 460, md: 500 }, minHeight: { xs: 360, sm: 420 } }}>
									<ResponsiveContainer width="100%" height="100%">
										<ScatterChart
											margin={{
												top: 20,
												right: isMediumScreen ? 20 : 80,
												bottom: isMediumScreen ? 40 : 60,
												left: isMediumScreen ? 10 : 20,
											}}
										>
											<CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={isSmallScreen ? 0.2 : 0.3} />
											<XAxis
												type="number"
												dataKey="x"
												name="Submission Order"
												domain={[0, 1]}
												tickFormatter={(value) => `${Math.round(value * 100)}%`}
												tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }}
												label={{
													value: 'Submission Order (0 = earliest, 1 = latest)',
													position: 'bottom',
													offset: isMediumScreen ? -5 : -10,
													style: { textAnchor: 'middle', fill: theme.palette.text.primary, fontSize: isMediumScreen ? '12px' : '14px', fontWeight: 'bold' }
												}}
											/>
											<YAxis
												type="number"
												dataKey="y"
												name="Votes Received"
												tick={{ fill: theme.palette.text.secondary, fontSize: isMediumScreen ? 10 : 12 }}
												label={{
													value: 'Votes Received',
													angle: -90,
													position: 'insideLeft',
													style: { textAnchor: 'middle', fill: theme.palette.text.primary, fontSize: isMediumScreen ? '12px' : '14px', fontWeight: 'bold' }
												}}
											/>
											<Tooltip content={({ active, payload }) => {
												if (active && payload && payload.length) {
													const dataPoint = payload[0].payload;
													return (
														<Paper sx={{
															p: { xs: 1.5, sm: 2 },
															backgroundColor: 'white',
															border: `2px solid ${theme.palette.primary.main}`,
															maxWidth: { xs: '260px', sm: '320px' },
															fontSize: { xs: '0.875rem', sm: '1rem' }
														}}>
															<Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
																{dataPoint.title || 'Submission'}
															</Typography>
															<Typography variant="body2" color="text.secondary">
																Submitter: {dataPoint.submitterName}
															</Typography>
															<Typography variant="body2">
																Round: {dataPoint.roundName || 'Unknown'}
															</Typography>
															<Typography variant="body2">
																Order: {dataPoint.order} of {dataPoint.orderTotal}
															</Typography>
															<Typography variant="body2">
																Votes: {dataPoint.votes}
															</Typography>
															<Typography variant="body2" sx={{ fontStyle: 'italic' }}>
																Submitted: {new Date(dataPoint.createdUtc).toLocaleString()}
															</Typography>
														</Paper>
													);
												}
												return null;
											}} />
											<Scatter
												data={submissionTiming.submissionRecords.map((record) => ({
													x: record.orderFraction,
													y: record.votes,
													submitterId: record.submitterId,
													submitterName: record.submitterName,
													roundName: record.roundName,
													order: record.order,
													orderTotal: record.orderTotal,
													createdUtc: record.createdUtc,
													title: record.title
												}))}
												fill={theme.palette.primary.main}
											>
												{submissionTiming.submissionRecords.map((record, index) => {
													if (!data?.competitors?.length) return null;
													const colors = [
														'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000',
														'#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082',
														'#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'
													];
													const competitorIndex = data.competitors.findIndex((comp) => comp.ID === record.submitterId);
													const colorIndex = competitorIndex >= 0 ? competitorIndex % colors.length : 0;
													return (
														<Cell
															key={`submission-timing-${record.spotifyUri}-${index}`}
															fill={colors[colorIndex]}
															fillOpacity={0.75}
															stroke={colors[colorIndex]}
															strokeWidth={isSmallScreen ? 1 : 1.8}
															r={isSmallScreen ? 4 : 5}
														/>
													);
												})}
											</Scatter>
											{(() => {
												if (!submissionTiming?.submissionRecords?.length) return null;
												const points = submissionTiming.submissionRecords;
												const n = points.length;
												let sumX = 0;
												let sumY = 0;
												let sumXY = 0;
												let sumXX = 0;
												let minX = 1;
												let maxX = 0;
												points.forEach((point) => {
													const xVal = point.orderFraction;
													const yVal = point.votes;
													sumX += xVal;
													sumY += yVal;
													sumXY += xVal * yVal;
													sumXX += xVal * xVal;
													minX = Math.min(minX, xVal);
													maxX = Math.max(maxX, xVal);
												});
												const denominator = n * sumXX - sumX * sumX;
												if (!denominator) return null;
												const slope = (n * sumXY - sumX * sumY) / denominator;
												const intercept = (sumY - slope * sumX) / n;
												const yStart = slope * minX + intercept;
												const yEnd = slope * maxX + intercept;
												if (!Number.isFinite(yStart) || !Number.isFinite(yEnd)) return null;
												return (
													<ReferenceLine
														key="timing-trend-line"
														segment={[
															{ x: minX, y: yStart },
															{ x: maxX, y: yEnd }
														]}
														stroke={theme.palette.text.secondary}
														strokeDasharray="6 6"
													/>
												);
											})()}
										</ScatterChart>
									</ResponsiveContainer>
								</Box>
								<Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontStyle: 'italic', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
									Points show each submission’s position in the round order (normalized). Hover or tap to see details.
								</Typography>
							</CardContent>
						</Card>
					</Box>
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
					{hasTimingData && (
						<Grid item xs={12} sm={6} md={4} lg={4} xl={3} sx={{
							paddingBottom: 3,
							display: 'flex',
							justifyContent: 'center'
						}}>
							<Box sx={{ width: '100%', maxWidth: '500px' }}>
								<SuperlativeCard
									title="Timing Maestro"
									description="Competitor whose submission timing most impacted their results"
									winnerName={submissionTiming?.bestCompetitor?.competitor?.Name || 'No standout identified'}
									detail={timingWinnerDetail}
									additionalCompetitors={timingAdditionalCompetitors}
									isTied={false}
									tiedWinners={null}
									calculationKey="submissionTimingImpact"
								/>
							</Box>
						</Grid>
					)}

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
				<IndividualPerformance data={data} season={season} timingStats={submissionTiming} />
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
					'&::-webkit-scrollbar': { width: '8px' },
					'&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '10px' },
					'&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '10px' }
				}}>
					{selectedRound && (
						<>
							<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
								<Typography variant="h5" sx={{
									fontWeight: 'bold',
									color: theme.palette.primary.main
								}}>
									{(() => {
										const rn = (typeof selectedRound.roundNumber === 'number' && selectedRound.roundNumber > 0) ? selectedRound.roundNumber : (selectedRound?.roundNumber ?? 1);
										const currentRound = data.rounds?.[rn - 1];
										return currentRound?.Name || `Round ${rn}`;
									})()}
								</Typography>
								<IconButton onClick={handleModalClose} size="small">
									<Close />
								</IconButton>
							</Box>

							{(() => {
								const rn = (typeof selectedRound.roundNumber === 'number' && selectedRound.roundNumber > 0) ? selectedRound.roundNumber : (selectedRound?.roundNumber ?? 1);
								const currentRound = data.rounds?.[rn - 1];

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
															p: 0.5
														}}
													>
														{/* Add any additional styling you want for the dot */}
													</Box>
													<Typography variant="body2" sx={{
														fontSize: { xs: '0.75rem', sm: '0.875rem' },
														mt: 0.5
													}}>
														{competitorName}
													</Typography>
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

			{/* Fullscreen Chart Modal */}
			<Modal open={fullscreenOpen} onClose={closeFullscreen} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<Box sx={{ width: '100vw', height: '100vh', bgcolor: 'background.paper', p: 1, position: 'relative' }}>
					<IconButton onClick={closeFullscreen} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }} aria-label="close fullscreen">
						<CloseFullscreenIcon />
					</IconButton>
					<Box sx={{ width: '100%', height: '100%', pt: 4 }}>
						<ResponsiveContainer width="100%" height="100%">
							{fullscreenChart === 'scatter' && (
								<ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 20 }}>
									<CartesianGrid strokeDasharray="3 3" opacity={0.2} />
									<XAxis type="number" dataKey="x" domain={[0, 100]} label={{ value: 'Spotify Popularity', position: 'bottom' }} />
									<YAxis type="number" dataKey="y" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} label={{ value: 'Relative Performance', angle: -90, position: 'insideLeft' }} />
									<Scatter data={(() => {
										if (!data?.submissions || !data?.votes) return [];
										const submissionVotes = {};
										data.votes.forEach(v => { const uri = v['Spotify URI']; submissionVotes[uri] = (submissionVotes[uri] || 0) + parseInt(v['Points Assigned'] || 0); });
										const totals = Object.values(submissionVotes); const max = Math.max(...totals); const min = Math.min(...totals); const range = max - min;
										return data.submissions.filter(s => s.popularity != null).map(s => ({ x: s.popularity, y: range > 0 ? ((submissionVotes[s['Spotify URI']] || 0) - min) / range : 0.5, submitterId: s['Submitter ID'] }));
									})()}>
										{(() => {
											const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'];
											return (data?.submissions || []).filter(s => s.popularity != null).map((s, i) => {
												const idx = data.competitors.findIndex(c => c.ID === s['Submitter ID']);
												const ci = idx >= 0 ? idx % colors.length : 0;
												return <Cell key={`fs-cell-${i}`} fill={colors[ci]} stroke={colors[ci]} r={6} />;
											});
										})()}
									</Scatter>
								</ScatterChart>
							)}
							{(fullscreenChart === 'lineRound' || fullscreenChart === 'lineCumulative') && (
								<LineChart data={generatePerformanceData(fullscreenChart === 'lineCumulative')} margin={{ top: 20, right: 40, bottom: 40, left: 20 }}>
									<CartesianGrid strokeDasharray="3 3" opacity={0.2} />
									<XAxis dataKey="round" type="number" domain={['dataMin', 'dataMax']} label={{ value: 'Round', position: 'insideBottom' }} />
									<YAxis label={{ value: fullscreenChart === 'lineCumulative' ? 'Total Votes Received' : 'Votes Received', angle: -90, position: 'insideLeft' }} />
									{(() => {
										const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'];
										const chartData = generatePerformanceData(fullscreenChart === 'lineCumulative');
										const visibleSet = getFilteredCompetitors(chartData);
										return data?.competitors?.map((competitor, index) => {
											if (!competitor || !competitor.Name) return null;
											const colorIndex = index % colors.length; const name = competitor.Name; if (!visibleSet.has(name)) return null;
											return <Line key={competitor.ID || index} type="linear" dataKey={name} stroke={colors[colorIndex]} strokeWidth={2} dot={false} connectNulls={fullscreenChart === 'lineCumulative'} />;
										}).filter(Boolean);
									})()}
								</LineChart>
							)}
							{fullscreenChart === 'voting' && (
								<Box sx={{ width: '100%', height: '100%' }}>
									<VotingGraph competitors={data.competitors} votes={data.votes} submissions={data.submissions} fullScreen />
								</Box>
							)}
						</ResponsiveContainer>
					</Box>
				</Box>
			</Modal>
		</Container>
	);
};

export default DashboardContent;