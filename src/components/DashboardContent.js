import React from 'react';
import { Container, Typography, Grid, Box, Tabs, Tab, useMediaQuery, useTheme } from '@mui/material';

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
									description="Received the highest average votes per submission"
									winnerName={superlatives?.leastPopular?.competitor?.Name}
									detail={`Average Votes: ${superlatives?.leastPopular?.avgPoints}`}
									additionalCompetitors={superlatives?.leastPopular?.restOfField}
									isTied={superlatives?.leastPopular?.isTied}
									tiedWinners={superlatives?.leastPopular?.tiedWinners}
									tiedDetails={superlatives?.leastPopular?.isTied ?
										superlatives?.leastPopular?.tiedWinners?.map(name =>
											`Average Votes: ${superlatives?.leastPopular?.avgPoints}`
										) : null}
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
									description="Closest to the overall average score across all submissions"
									winnerName={superlatives?.mostAverage?.competitor?.Name}
									detail={`Average Votes: ${superlatives?.mostAverage?.avgPoints} (Overall Avg: ${superlatives?.mostAverage?.overallAvg})`}
									additionalCompetitors={superlatives?.mostAverage?.restOfField}
									isTied={superlatives?.mostAverage?.isTied}
									tiedWinners={superlatives?.mostAverage?.tiedWinners}
									tiedDetails={superlatives?.mostAverage?.isTied ?
										superlatives?.mostAverage?.tiedWinners?.map(name =>
											`Average Votes: ${superlatives?.mostAverage?.avgPoints} (Overall Avg: ${superlatives?.mostAverage?.overallAvg})`
										) : null}
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
									description="Made the biggest comeback from their lowest-scoring submission to their best subsequent performance"
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
									description="Submitted the most obscure songs based on Spotify popularity (lower scores are more obscure)"
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
									description="Submitted the most popular songs based on Spotify popularity (higher scores are more popular)"
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
									description="Distributes their votes most evenly across all submissions, based on lowest standard deviation of votes assigned"
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
									description="Gave the highest percentage of their total votes as single votes to songs"
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
									description="Assigned all their votes to a single song in the highest percentage of rounds"
									winnerName={superlatives?.maxVoteGiver?.competitor?.Name}
									detail={`${superlatives?.maxVoteGiver?.allInRounds}/${superlatives?.maxVoteGiver?.totalRounds} rounds (${superlatives?.maxVoteGiver?.allInPercentage}%) went all-in on one song`}
									additionalCompetitors={superlatives?.maxVoteGiver?.restOfField}
									isTied={superlatives?.maxVoteGiver?.isTied}
									tiedWinners={superlatives?.maxVoteGiver?.tiedWinners}
									tiedDetails={superlatives?.maxVoteGiver?.isTied ?
										superlatives?.maxVoteGiver?.tiedWinners?.map(
											name => `${superlatives?.maxVoteGiver?.allInRounds}/${superlatives?.maxVoteGiver?.totalRounds} rounds (${superlatives?.maxVoteGiver?.allInPercentage}%)`
										) : null
									}
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
									description={superlatives?.votingTiming?.earlyVoter?.description}
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
									description={superlatives?.votingTiming?.lateVoter?.description}
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
									description="Pair who consistently gave each other high votes, calculated as the geometric mean of average votes exchanged"
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
									description="Pair who consistently gave each other low votes, calculated as the geometric mean of average votes exchanged"
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
									description="Pair who voted the most similarly across songs, based on average difference in votes assigned"
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
									description="Pair who voted the most differently across songs, based on average difference in votes assigned"
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
		</Container>
	);
};

export default DashboardContent; 