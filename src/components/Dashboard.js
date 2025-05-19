import React, { useState, useEffect } from 'react';
import { Container, Typography, Grid, CircularProgress, Box, FormControl, Select, MenuItem, InputLabel } from '@mui/material';
import { loadAllData, calculateAllSuperlatives } from '../utils/dataProcessor';

// Individual award components
import SuperlativeCard from './SuperlativeCard';
import VotingGraph from './VotingGraph';

const Dashboard = () => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [superlatives, setSuperlatives] = useState(null);
	const [data, setData] = useState(null);
	const [season, setSeason] = useState('season1');
	const [availableSeasons] = useState(['season1']);

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

	return (
		<Container maxWidth="xl" sx={{ mt: 4, mb: 4, px: { xs: 2, sm: 3, md: 4 } }}>
			<Typography variant="h3" component="h1" gutterBottom align="center">
				Suit & Tie Music League Wrapped
			</Typography>

			<Typography variant="h6" gutterBottom align="center" sx={{ mb: 3 }}>
				Insights and Awards from Music League
			</Typography>

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

			{/* Voting Graph Visualization */}
			<Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
				<VotingGraph
					competitors={data.competitors}
					votes={data.votes}
					submissions={data.submissions}
				/>
			</Box>

			<Typography variant="h4" component="h2" gutterBottom align="center" sx={{ mb: 4, mt: 2 }}>
				League Superlatives
			</Typography>

			<Box sx={{ flexGrow: 1, width: '100%' }}>
				<Grid container spacing={3} sx={{ width: '100%', margin: 0 }}>
					{/* Most Popular */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Most Popular Overall"
							description="Received the most total votes across all submissions"
							winnerName={superlatives.mostPopular.competitor?.Name}
							detail={`Total Votes: ${superlatives.mostPopular.points}`}
							additionalCompetitors={superlatives.mostPopular.restOfField}
							isTied={superlatives.mostPopular.isTied}
							tiedWinners={superlatives.mostPopular.tiedWinners}
							tiedDetails={superlatives.mostPopular.isTied ?
								superlatives.mostPopular.tiedWinners.map(name =>
									`Total Votes: ${superlatives.mostPopular.points}`
								) : null}
						/>
					</Grid>

					{/* Most Popular (on average) - formerly Least Popular */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Consistently Popular"
							description="Received the highest average votes per submission"
							winnerName={superlatives.leastPopular.competitor?.Name}
							detail={`Average Votes: ${superlatives.leastPopular.avgPoints}`}
							additionalCompetitors={superlatives.leastPopular.restOfField}
							isTied={superlatives.leastPopular.isTied}
							tiedWinners={superlatives.leastPopular.tiedWinners}
							tiedDetails={superlatives.leastPopular.isTied ?
								superlatives.leastPopular.tiedWinners.map(name =>
									`Average Votes: ${superlatives.leastPopular.avgPoints}`
								) : null}
						/>
					</Grid>

					{/* Most Average */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Most Average"
							description="Closest to the overall average score across all submissions"
							winnerName={superlatives.mostAverage.competitor?.Name}
							detail={`Average Votes: ${superlatives.mostAverage.avgPoints} (Overall Avg: ${superlatives.mostAverage.overallAvg})`}
							additionalCompetitors={superlatives.mostAverage.restOfField}
							isTied={superlatives.mostAverage.isTied}
							tiedWinners={superlatives.mostAverage.tiedWinners}
							tiedDetails={superlatives.mostAverage.isTied ?
								superlatives.mostAverage.tiedWinners.map(name =>
									`Average Votes: ${superlatives.mostAverage.avgPoints} (Overall Avg: ${superlatives.mostAverage.overallAvg})`
								) : null}
						/>
					</Grid>

					{/* Best Performance */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Best Performance"
							description="Highest score in a single round"
							winnerName={superlatives.bestPerformance.competitor?.Name}
							detail={
								`Score: ${superlatives.bestPerformance.score} votes
								Round: "${superlatives.bestPerformance.round?.Name}"
								Song: "${superlatives.bestPerformance.songTitle}" by ${superlatives.bestPerformance.artist}`
							}
							additionalCompetitors={superlatives.bestPerformance.restOfField}
							isTied={superlatives.bestPerformance.isTied}
							tiedWinners={superlatives.bestPerformance.tiedWinners}
							tiedDetails={superlatives.bestPerformance.isTied ?
								superlatives.bestPerformance.tiedWinners.map(winner => {
									// Extract the competitor name and song title from the format "Name ("Song")"
									const match = winner.match(/(.*) \("(.*)"\)/);
									if (match) {
										const name = match[1];
										const song = match[2];
										// Find the corresponding tied performance
										const performance = superlatives.bestPerformance.tiedPerformances?.find(
											p => p.competitor?.Name === name && p.songTitle === song
										);
										if (performance) {
											return `Score: ${performance.score} votes
								Round: "${performance.round?.Name}"
								Song: "${performance.songTitle}" by ${performance.artist}`;
										}
									}
									return `Score: ${superlatives.bestPerformance.score} votes`;
								}) : null
							}
						/>
					</Grid>

					{/* Longest Comment */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Longest Comment"
							description="Left the most verbose feedback"
							winnerName={superlatives.longestComment.competitor?.Name}
							detail={`${superlatives.longestComment.commentLength} characters: "${superlatives.longestComment.comment}"`}
							additionalCompetitors={superlatives.longestComment.restOfField}
							isTied={superlatives.longestComment.isTied}
							tiedWinners={superlatives.longestComment.tiedWinners}
							tiedDetails={superlatives.longestComment.isTied ?
								superlatives.longestComment.tiedComments?.map(
									c => `${c.commentLength} characters: "${c.comment}"`
								) ||
								superlatives.longestComment.tiedWinners.map(
									name => `${superlatives.longestComment.commentLength} characters`
								) : null
							}
						/>
					</Grid>

					{/* Most Comments */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Most Comments Given"
							description="Left the most comments when voting"
							winnerName={superlatives.mostComments.competitor?.Name}
							detail={`${superlatives.mostComments.commentCount} comments`}
							additionalCompetitors={superlatives.mostComments.restOfField}
							isTied={superlatives.mostComments.isTied}
							tiedWinners={superlatives.mostComments.tiedWinners}
							tiedDetails={superlatives.mostComments.isTied ?
								superlatives.mostComments.tiedWinners.map(
									name => `${superlatives.mostComments.commentCount} comments`
								) : null
							}
						/>
					</Grid>

					{/* Most Compatible */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Most Compatible"
							description="Pair who consistently gave each other high votes, calculated as the geometric mean of average votes exchanged"
							winnerName={`${superlatives.compatibility.mostCompatible.competitor1?.Name} & ${superlatives.compatibility.mostCompatible.competitor2?.Name}`}
							detail={`Compatibility Score: ${superlatives.compatibility.mostCompatible.score}
								${superlatives.compatibility.mostCompatible.competitor1?.Name} → ${superlatives.compatibility.mostCompatible.competitor2?.Name}: ${superlatives.compatibility.mostCompatible.avgAToB} avg votes
								${superlatives.compatibility.mostCompatible.competitor2?.Name} → ${superlatives.compatibility.mostCompatible.competitor1?.Name}: ${superlatives.compatibility.mostCompatible.avgBToA} avg votes`}
							additionalCompetitors={superlatives.compatibility.mostCompatible.restOfField}
							isTied={superlatives.compatibility.mostCompatible.isTied}
							tiedWinners={superlatives.compatibility.mostCompatible.tiedWinners}
							tiedDetails={superlatives.compatibility.mostCompatible.isTied ?
								superlatives.compatibility.mostCompatible.tiedPairs?.map(pair =>
									`Compatibility Score: ${pair.score}
								${pair.competitor1.Name} → ${pair.competitor2.Name}: ${pair.avgAToB} avg votes
								${pair.competitor2.Name} → ${pair.competitor1.Name}: ${pair.avgBToA} avg votes`
								) ||
								superlatives.compatibility.mostCompatible.tiedWinners.map(
									name => `Compatibility Score: ${superlatives.compatibility.mostCompatible.score}`
								) : null
							}
						/>
					</Grid>

					{/* Least Compatible */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Least Compatible"
							description="Pair who consistently gave each other low votes, calculated as the geometric mean of average votes exchanged"
							winnerName={`${superlatives.compatibility.leastCompatible.competitor1?.Name} & ${superlatives.compatibility.leastCompatible.competitor2?.Name}`}
							detail={`Compatibility Score: ${superlatives.compatibility.leastCompatible.score}
								${superlatives.compatibility.leastCompatible.competitor1?.Name} → ${superlatives.compatibility.leastCompatible.competitor2?.Name}: ${superlatives.compatibility.leastCompatible.avgAToB} avg votes
								${superlatives.compatibility.leastCompatible.competitor2?.Name} → ${superlatives.compatibility.leastCompatible.competitor1?.Name}: ${superlatives.compatibility.leastCompatible.avgBToA} avg votes`}
							additionalCompetitors={superlatives.compatibility.leastCompatible.restOfField}
							isTied={superlatives.compatibility.leastCompatible.isTied}
							tiedWinners={superlatives.compatibility.leastCompatible.tiedWinners}
							tiedDetails={superlatives.compatibility.leastCompatible.isTied ?
								superlatives.compatibility.leastCompatible.tiedPairs?.map(pair =>
									`Compatibility Score: ${pair.score}
								${pair.competitor1.Name} → ${pair.competitor2.Name}: ${pair.avgAToB} avg votes
								${pair.competitor2.Name} → ${pair.competitor1.Name}: ${pair.avgBToA} avg votes`
								) ||
								superlatives.compatibility.leastCompatible.tiedWinners.map(
									name => `Compatibility Score: ${superlatives.compatibility.leastCompatible.score}`
								) : null
							}
						/>
					</Grid>

					{/* Most Similar Voting */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Most Similar Voting Patterns"
							description="Pair who gave similar votes to the same submissions, with a similarity score of 5 minus the average vote difference"
							winnerName={`${superlatives.similarity.mostSimilar.competitor1?.Name} & ${superlatives.similarity.mostSimilar.competitor2?.Name}`}
							detail={`Similarity Score: ${superlatives.similarity.mostSimilar.score}
								Based on ${superlatives.similarity.mostSimilar.votesCompared} common votes
								Average vote difference: ${superlatives.similarity.mostSimilar.avgDiff} votes`}
							additionalCompetitors={superlatives.similarity.mostSimilar.restOfField}
							isTied={superlatives.similarity.mostSimilar.isTied}
							tiedWinners={superlatives.similarity.mostSimilar.tiedWinners}
							tiedDetails={superlatives.similarity.mostSimilar.isTied ?
								superlatives.similarity.mostSimilar.tiedPairs?.map(pair =>
									`Similarity Score: ${pair.similarity.toFixed(2)}
								Based on ${pair.votesCompared} common votes
								Average vote difference: ${pair.avgDiff} votes`
								) ||
								superlatives.similarity.mostSimilar.tiedWinners.map(
									name => `Similarity Score: ${superlatives.similarity.mostSimilar.score}`
								) : null
							}
						/>
					</Grid>

					{/* Most Dissimilar Voting */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Most Dissimilar Voting Patterns"
							description="Pair who gave different votes to the same submissions, with a similarity score of 5 minus the average vote difference"
							winnerName={`${superlatives.similarity.leastSimilar.competitor1?.Name} & ${superlatives.similarity.leastSimilar.competitor2?.Name}`}
							detail={`Similarity Score: ${superlatives.similarity.leastSimilar.score}
								Based on ${superlatives.similarity.leastSimilar.votesCompared} common votes
								Average vote difference: ${superlatives.similarity.leastSimilar.avgDiff} votes`}
							additionalCompetitors={superlatives.similarity.leastSimilar.restOfField}
							isTied={superlatives.similarity.leastSimilar.isTied}
							tiedWinners={superlatives.similarity.leastSimilar.tiedWinners}
							tiedDetails={superlatives.similarity.leastSimilar.isTied ?
								superlatives.similarity.leastSimilar.tiedPairs?.map(pair =>
									`Similarity Score: ${pair.similarity.toFixed(2)}
								Based on ${pair.votesCompared} common votes
								Average vote difference: ${pair.avgDiff} votes`
								) ||
								superlatives.similarity.leastSimilar.tiedWinners.map(
									name => `Similarity Score: ${superlatives.similarity.leastSimilar.score}`
								) : null
							}
						/>
					</Grid>

					{/* Early Voter */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Most Likely to Vote First"
							description="Consistently among the first 25% of voters to submit votes in a round"
							winnerName={superlatives.votingTiming.earlyVoter.competitor?.Name}
							detail={`Among the first 25% of voters ${superlatives.votingTiming.earlyVoter.earlyVotes} times`}
							additionalCompetitors={superlatives.votingTiming.earlyVoter.restOfField}
							isTied={superlatives.votingTiming.earlyVoter.isTied}
							tiedWinners={superlatives.votingTiming.earlyVoter.tiedWinners}
							tiedDetails={superlatives.votingTiming.earlyVoter.isTied ?
								superlatives.votingTiming.earlyVoter.tiedWinners.map(
									name => `Among the first 25% of voters ${superlatives.votingTiming.earlyVoter.earlyVotes} times`
								) : null
							}
						/>
					</Grid>

					{/* Late Voter */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Most Likely to Vote Last"
							description="Consistently among the last 25% of voters to submit votes in a round"
							winnerName={superlatives.votingTiming.lateVoter.competitor?.Name}
							detail={`Among the last 25% of voters ${superlatives.votingTiming.lateVoter.lateVotes} times`}
							additionalCompetitors={superlatives.votingTiming.lateVoter.restOfField}
							isTied={superlatives.votingTiming.lateVoter.isTied}
							tiedWinners={superlatives.votingTiming.lateVoter.tiedWinners}
							tiedDetails={superlatives.votingTiming.lateVoter.isTied ?
								superlatives.votingTiming.lateVoter.tiedWinners.map(
									name => `Among the last 25% of voters ${superlatives.votingTiming.lateVoter.lateVotes} times`
								) : null
							}
						/>
					</Grid>

					{/* Crowd Pleaser */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Crowd Pleaser"
							description="Submitted songs with the highest average Spotify popularity"
							winnerName={superlatives.spotify?.crowdPleaser.competitor?.Name}
							detail={`Average Song Popularity: ${superlatives.spotify?.crowdPleaser.avgPopularity} / 100 (${superlatives.spotify?.crowdPleaser.submissionCount} submissions)`}
							additionalCompetitors={superlatives.spotify?.crowdPleaser.restOfField}
							isTied={superlatives.spotify?.crowdPleaser.isTied}
							tiedWinners={superlatives.spotify?.crowdPleaser.tiedWinners}
							tiedDetails={superlatives.spotify?.crowdPleaser.isTied ?
								superlatives.spotify?.crowdPleaser.tiedWinners.map(name =>
									`Average Song Popularity: ${superlatives.spotify?.crowdPleaser.avgPopularity} / 100`
								) : null
							}
						/>
					</Grid>

					{/* Trend Setter */}
					<Grid item xs={12} sm={6} md={4} sx={{ paddingBottom: 3 }}>
						<SuperlativeCard
							title="Trend Setter"
							description="Submitted songs with the lowest average Spotify popularity"
							winnerName={superlatives.spotify?.trendSetter.competitor?.Name}
							detail={`Average Song Popularity: ${superlatives.spotify?.trendSetter.avgPopularity} / 100 (${superlatives.spotify?.trendSetter.submissionCount} submissions)`}
							additionalCompetitors={superlatives.spotify?.trendSetter.restOfField}
							isTied={superlatives.spotify?.trendSetter.isTied}
							tiedWinners={superlatives.spotify?.trendSetter.tiedWinners}
							tiedDetails={superlatives.spotify?.trendSetter.isTied ?
								superlatives.spotify?.trendSetter.tiedWinners.map(name =>
									`Average Song Popularity: ${superlatives.spotify?.trendSetter.avgPopularity} / 100`
								) : null
							}
						/>
					</Grid>
				</Grid>
			</Box>
		</Container>
	);
};

export default Dashboard;