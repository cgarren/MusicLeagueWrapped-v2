import Papa from 'papaparse';
import { getTracksPopularity, extractTrackIdsFromUris } from './spotifyApi';

// Function to load and parse a CSV file
const loadCSV = async (filePath) => {
	try {
		const response = await fetch(filePath);
		const csvText = await response.text();
		return new Promise((resolve, reject) => {
			Papa.parse(csvText, {
				header: true,
				complete: (results) => {
					resolve(results.data);
				},
				error: (error) => {
					reject(error);
				}
			});
		});
	} catch (error) {
		console.error(`Error loading CSV from ${filePath}:`, error);
		return [];
	}
};

// Load all datasets
export const loadAllData = async (season = 'season1') => {
	try {
		const competitors = await loadCSV(`/data/${season}/competitors.csv`);
		const rounds = await loadCSV(`/data/${season}/rounds.csv`);
		const submissions = await loadCSV(`/data/${season}/submissions.csv`);
		const votes = await loadCSV(`/data/${season}/votes.csv`);

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

		return {
			competitors,
			rounds,
			submissions: submissionsWithPopularity,
			votes,
			trackPopularityData
		};
	} catch (error) {
		console.error('Error loading data:', error);
		return { competitors: [], rounds: [], submissions: [], votes: [], trackPopularityData: {} };
	}
};

// Calculate most popular competitor (most total points received)
export const calculateMostPopular = (votes, submissions, competitors) => {
	const pointsBySubmitter = {};

	// Map submissions to their submitters
	const submissionMap = submissions.reduce((map, submission) => {
		map[submission['Spotify URI']] = submission['Submitter ID'];
		return map;
	}, {});

	// Count points by submitter
	votes.forEach(vote => {
		const spotifyUri = vote['Spotify URI'];
		const submitterId = submissionMap[spotifyUri];
		if (submitterId) {
			pointsBySubmitter[submitterId] = (pointsBySubmitter[submitterId] || 0) + parseInt(vote['Points Assigned'] || 0);
		}
	});

	// Create array of all competitors with their points
	const allCompetitorsWithPoints = Object.entries(pointsBySubmitter).map(([submitterId, points]) => {
		const competitor = competitors.find(comp => comp.ID === submitterId);
		return {
			competitor,
			points
		};
	}).filter(item => item.competitor); // Filter out any undefined competitors

	// Sort by points (descending)
	allCompetitorsWithPoints.sort((a, b) => b.points - a.points);

	// Check for ties (multiple competitors with the same top score)
	const topScore = allCompetitorsWithPoints[0]?.points;
	const tiedWinners = allCompetitorsWithPoints.filter(item => item.points === topScore);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = allCompetitorsWithPoints[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? allCompetitorsWithPoints.filter(item => item.points !== topScore).map(item => ({
			name: item.competitor.Name,
			score: item.points + " votes"
		}))
		: allCompetitorsWithPoints.slice(1).map(item => ({
			name: item.competitor.Name,
			score: item.points + " votes"
		}));

	return {
		competitor: winner?.competitor,
		points: winner?.points,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate least popular competitor (least average points per submission)
export const calculateLeastPopular = (votes, submissions, competitors) => {
	const pointsBySubmitter = {};
	const submissionCountBySubmitter = {};

	// Map submissions to their submitters
	const submissionMap = submissions.reduce((map, submission) => {
		const submitterId = submission['Submitter ID'];
		map[submission['Spotify URI']] = submitterId;
		submissionCountBySubmitter[submitterId] = (submissionCountBySubmitter[submitterId] || 0) + 1;
		return map;
	}, {});

	// Count points by submitter
	votes.forEach(vote => {
		const spotifyUri = vote['Spotify URI'];
		const submitterId = submissionMap[spotifyUri];
		if (submitterId) {
			pointsBySubmitter[submitterId] = (pointsBySubmitter[submitterId] || 0) + parseInt(vote['Points Assigned'] || 0);
		}
	});

	// Calculate average points per submission
	const competitors_with_avg = [];
	Object.keys(submissionCountBySubmitter).forEach(submitterId => {
		if (submissionCountBySubmitter[submitterId] >= 3) {
			const avgPoints = (pointsBySubmitter[submitterId] || 0) / submissionCountBySubmitter[submitterId];
			const competitor = competitors.find(comp => comp.ID === submitterId);
			if (competitor) {
				competitors_with_avg.push({
					competitor,
					avgPoints
				});
			}
		}
	});

	// Sort by average points (highest average first - descending)
	competitors_with_avg.sort((a, b) => b.avgPoints - a.avgPoints);

	// Check for ties (multiple competitors with the same top score)
	const topAvg = competitors_with_avg[0]?.avgPoints;
	const tiedWinners = competitors_with_avg.filter(item => item.avgPoints === topAvg);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array (highest average points)
	const winner = competitors_with_avg[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? competitors_with_avg.filter(item => item.avgPoints !== topAvg).map(item => ({
			name: item.competitor.Name,
			score: item.avgPoints.toFixed(2) + " votes"
		}))
		: competitors_with_avg.slice(1).map(item => ({
			name: item.competitor.Name,
			score: item.avgPoints.toFixed(2) + " votes"
		}));

	return {
		competitor: winner?.competitor,
		avgPoints: winner?.avgPoints.toFixed(2),
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate most average competitor (closest to overall average score)
export const calculateMostAverage = (votes, submissions, competitors) => {
	const pointsBySubmitter = {};
	const submissionCountBySubmitter = {};

	// Map submissions to their submitters
	const submissionMap = submissions.reduce((map, submission) => {
		const submitterId = submission['Submitter ID'];
		map[submission['Spotify URI']] = submitterId;
		submissionCountBySubmitter[submitterId] = (submissionCountBySubmitter[submitterId] || 0) + 1;
		return map;
	}, {});

	// Count points by submitter
	votes.forEach(vote => {
		const spotifyUri = vote['Spotify URI'];
		const submitterId = submissionMap[spotifyUri];
		if (submitterId) {
			pointsBySubmitter[submitterId] = (pointsBySubmitter[submitterId] || 0) + parseInt(vote['Points Assigned'] || 0);
		}
	});

	// Calculate average points per submission for all competitors
	const competitorsWithAvg = [];
	let totalAvgPoints = 0;
	let competitorCount = 0;

	Object.keys(submissionCountBySubmitter).forEach(submitterId => {
		if (submissionCountBySubmitter[submitterId] >= 3) {
			const avg = (pointsBySubmitter[submitterId] || 0) / submissionCountBySubmitter[submitterId];
			const competitor = competitors.find(comp => comp.ID === submitterId);
			if (competitor) {
				competitorsWithAvg.push({
					competitor,
					avgPoints: avg
				});
				totalAvgPoints += avg;
				competitorCount++;
			}
		}
	});

	// Calculate the overall average points
	const overallAvg = totalAvgPoints / competitorCount;

	// Add difference from average to each competitor
	competitorsWithAvg.forEach(item => {
		item.difference = Math.abs(item.avgPoints - overallAvg);
	});

	// Sort by difference (ascending for most average)
	competitorsWithAvg.sort((a, b) => a.difference - b.difference);

	// Check for ties (multiple competitors with the same difference from average)
	const smallestDiff = competitorsWithAvg[0]?.difference;
	const tiedWinners = competitorsWithAvg.filter(item => item.difference === smallestDiff);
	const isTied = tiedWinners.length > 1;

	// The winner (most average) is the first item in the sorted array
	const winner = competitorsWithAvg[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithAvg.filter(item => item.difference !== smallestDiff).map(item => ({
			name: item.competitor.Name,
			score: `${item.avgPoints.toFixed(2)} votes (diff: ${item.difference.toFixed(2)})`
		}))
		: competitorsWithAvg.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.avgPoints.toFixed(2)} votes (diff: ${item.difference.toFixed(2)})`
		}));

	return {
		competitor: winner?.competitor,
		avgPoints: winner?.avgPoints.toFixed(2),
		overallAvg: overallAvg.toFixed(2),
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate best performance in a week (highest points in a single round)
export const calculateBestPerformance = (votes, submissions, competitors, rounds) => {
	const scoresBySubmissionAndRound = {};
	const submissionData = {};

	// Map submissions to their submitters and rounds
	submissions.forEach(submission => {
		const spotifyUri = submission['Spotify URI'];
		submissionData[spotifyUri] = {
			submitterId: submission['Submitter ID'],
			roundId: submission['Round ID'],
			title: submission['Title'],
			artist: submission['Artist(s)']
		};
	});

	// Count points by submission and round
	votes.forEach(vote => {
		const spotifyUri = vote['Spotify URI'];
		const roundId = vote['Round ID'];
		const submissionInfo = submissionData[spotifyUri];

		if (submissionInfo && submissionInfo.roundId === roundId) {
			const key = `${spotifyUri}|${roundId}`;
			scoresBySubmissionAndRound[key] = (scoresBySubmissionAndRound[key] || 0) + parseInt(vote['Points Assigned'] || 0);
		}
	});

	// Create array of performances
	const performances = [];

	Object.entries(scoresBySubmissionAndRound).forEach(([key, score]) => {
		const [spotifyUri, roundId] = key.split('|');
		const submissionInfo = submissionData[spotifyUri];

		if (submissionInfo) {
			const competitor = competitors.find(comp => comp.ID === submissionInfo.submitterId);
			const round = rounds.find(r => r.ID === roundId);

			performances.push({
				competitor,
				round,
				score,
				songTitle: submissionInfo.title,
				artist: submissionInfo.artist
			});
		}
	});

	// Sort performances by score (descending)
	performances.sort((a, b) => b.score - a.score);

	// Check for ties (multiple performances with the same top score)
	const topScore = performances[0]?.score;
	const tiedPerformances = performances.filter(item => item.score === topScore);
	const isTied = tiedPerformances.length > 1;

	// The best performance is the first item in the sorted array
	const bestPerformance = performances[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedPerformances.map(item => {
		return `${item.competitor?.Name} ("${item.songTitle}")`;
	}) : null;

	// Rest of the top performances (excluding the winners)
	const restOfField = isTied
		? performances.filter(item => item.score !== topScore).slice(0, 9).map(item => ({
			name: item.competitor?.Name,
			score: `${item.score} votes - "${item.songTitle}" (${item.round?.Name})`
		}))
		: performances.slice(1, 10).map(item => ({
			name: item.competitor?.Name,
			score: `${item.score} votes - "${item.songTitle}" (${item.round?.Name})`
		}));

	return {
		competitor: bestPerformance?.competitor,
		round: bestPerformance?.round,
		score: bestPerformance?.score,
		songTitle: bestPerformance?.songTitle,
		artist: bestPerformance?.artist,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames,
		tiedPerformances: isTied ? tiedPerformances : null
	};
};

// Calculate competitor with the longest comment
export const calculateLongestComment = (votes, submissions, competitors) => {
	// Filter votes that have comments
	const votesWithComments = votes.filter(vote => vote.Comment && vote.Comment.trim() !== '');

	// Create array of competitors with their longest comment
	const competitorsWithLongestComments = [];
	const competitorLongestComment = {};

	votesWithComments.forEach(vote => {
		const voterId = vote['Voter ID'];
		const comment = vote.Comment;

		// Skip if no comment or not a valid competitor
		if (!comment || !competitors.find(comp => comp.ID === voterId)) return;

		// Update if this is the longest comment for this competitor
		if (!competitorLongestComment[voterId] || comment.length > competitorLongestComment[voterId].length) {
			competitorLongestComment[voterId] = comment;
		}
	});

	// Convert to array for sorting
	Object.entries(competitorLongestComment).forEach(([voterId, comment]) => {
		const competitor = competitors.find(comp => comp.ID === voterId);
		if (competitor) {
			competitorsWithLongestComments.push({
				competitor,
				comment,
				commentLength: comment.length
			});
		}
	});

	// Sort by comment length (descending)
	competitorsWithLongestComments.sort((a, b) => b.commentLength - a.commentLength);

	// Check for ties (multiple competitors with the same longest comment length)
	const longestLength = competitorsWithLongestComments[0]?.commentLength;
	const tiedWinners = competitorsWithLongestComments.filter(item => item.commentLength === longestLength);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithLongestComments[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding the winners)
	const restOfField = isTied
		? competitorsWithLongestComments.filter(item => item.commentLength !== longestLength).map(item => ({
			name: item.competitor.Name,
			score: `${item.commentLength} characters`
		}))
		: competitorsWithLongestComments.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.commentLength} characters`
		}));

	return {
		competitor: winner?.competitor,
		comment: winner?.comment,
		commentLength: winner?.commentLength,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames,
		tiedComments: isTied ? tiedWinners.map(winner => ({
			comment: winner.comment,
			commentLength: winner.commentLength
		})) : null
	};
};

// Calculate competitor who left the most comments
export const calculateMostComments = (votes, competitors) => {
	// Count comments by voter ID
	const commentCountsByVoter = {};

	votes.forEach(vote => {
		const voterId = vote['Voter ID'];
		const comment = vote.Comment || '';

		// Skip if no comment
		if (!comment || comment.trim() === '') return;

		// Increment comment count for this voter
		commentCountsByVoter[voterId] = (commentCountsByVoter[voterId] || 0) + 1;
	});

	// Create array of competitors with their comment counts
	const competitorsWithCommentCounts = Object.entries(commentCountsByVoter).map(([voterId, count]) => {
		const competitor = competitors.find(comp => comp.ID === voterId);
		return {
			competitor,
			commentCount: count
		};
	}).filter(item => item.competitor); // Filter out any undefined competitors

	// Sort by comment count (descending)
	competitorsWithCommentCounts.sort((a, b) => b.commentCount - a.commentCount);

	// Check for ties (multiple competitors with the same comment count)
	const highestCount = competitorsWithCommentCounts[0]?.commentCount;
	const tiedWinners = competitorsWithCommentCounts.filter(item => item.commentCount === highestCount);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithCommentCounts[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding the winners)
	const restOfField = isTied
		? competitorsWithCommentCounts.filter(item => item.commentCount !== highestCount).map(item => ({
			name: item.competitor.Name,
			score: `${item.commentCount} comments`
		}))
		: competitorsWithCommentCounts.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.commentCount} comments`
		}));

	return {
		competitor: winner?.competitor,
		commentCount: winner?.commentCount,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate most compatible pair of competitors
export const calculateMostCompatible = (votes, submissions, competitors) => {
	// Build a map of submissions to submitters
	const submissionToSubmitter = {};
	submissions.forEach(submission => {
		submissionToSubmitter[submission['Spotify URI']] = submission['Submitter ID'];
	});

	// Build a matrix of votes: how many points A gave to B's submissions
	const voteMatrix = {};
	const submissionCounts = {};

	votes.forEach(vote => {
		const voterId = vote['Voter ID'];
		const submissionUri = vote['Spotify URI'];
		const submitterId = submissionToSubmitter[submissionUri];
		const points = parseInt(vote['Points Assigned'] || 0);

		// Skip self-votes
		if (voterId === submitterId) return;

		// Initialize matrix entries if they don't exist
		if (!voteMatrix[voterId]) voteMatrix[voterId] = {};
		if (!voteMatrix[voterId][submitterId]) voteMatrix[voterId][submitterId] = 0;

		// Count votes
		voteMatrix[voterId][submitterId] += points;

		// Count submissions
		if (!submissionCounts[submitterId]) submissionCounts[submitterId] = new Set();
		submissionCounts[submitterId].add(submissionUri);
	});

	// Calculate compatibility scores (average points given) for all pairs
	const allCompatibilityScores = [];
	const processedPairs = new Set(); // Track which pairs we've already processed

	Object.keys(voteMatrix).forEach(personA => {
		Object.keys(voteMatrix[personA] || {}).forEach(personB => {
			// Skip if B didn't vote for A (we need bidirectional compatibility)
			if (!voteMatrix[personB] || !voteMatrix[personB][personA]) return;

			// Create a unique key for the pair (sorted by ID to ensure consistency)
			const pairKey = [personA, personB].sort().join('|');

			// Skip if we've already processed this pair
			if (processedPairs.has(pairKey)) return;
			processedPairs.add(pairKey);

			const pointsAToB = voteMatrix[personA][personB];
			const pointsBToA = voteMatrix[personB][personA];

			const submissionsA = submissionCounts[personA]?.size || 0;
			const submissionsB = submissionCounts[personB]?.size || 0;

			// Skip if too few submissions
			if (submissionsA < 3 || submissionsB < 3) return;

			// Calculate average points (compatibility score)
			const avgAToB = pointsAToB / submissionsB;
			const avgBToA = pointsBToA / submissionsA;

			// Use the geometric mean for overall compatibility
			const compatibility = Math.sqrt(avgAToB * avgBToA);

			const person1 = competitors.find(comp => comp.ID === personA);
			const person2 = competitors.find(comp => comp.ID === personB);

			if (person1 && person2) {
				allCompatibilityScores.push({
					competitor1: person1,
					competitor2: person2,
					score: compatibility,
					avgAToB: avgAToB.toFixed(2),
					avgBToA: avgBToA.toFixed(2),
					pairKey: pairKey // Store the pairKey for later reference
				});
			}
		});
	});

	// Sort pairs by compatibility score (descending for most compatible)
	allCompatibilityScores.sort((a, b) => b.score - a.score);

	// Check for ties (multiple pairs with the same top compatibility score)
	const topScore = allCompatibilityScores[0]?.score;
	const tiedPairs = allCompatibilityScores.filter(item => item.score === topScore);
	const isTied = tiedPairs.length > 1;

	// The most compatible pair is the first item in the sorted array
	const mostCompatible = allCompatibilityScores[0] || {};

	// Get tied pairs' names if there's a tie
	const tiedWinnersNames = isTied ? tiedPairs.map(item =>
		`${item.competitor1.Name} & ${item.competitor2.Name}`
	) : null;

	// Rest of the field (excluding the tied pairs if there's a tie)
	const restOfField = isTied
		? allCompatibilityScores.filter(item => item.score !== topScore).slice(0, 8).map(item => ({
			name: `${item.competitor1.Name} & ${item.competitor2.Name}`,
			score: `Score: ${item.score.toFixed(2)}`
		}))
		: allCompatibilityScores.slice(1, 9).map(item => ({
			name: `${item.competitor1.Name} & ${item.competitor2.Name}`,
			score: `Score: ${item.score.toFixed(2)}`
		}));

	return {
		competitor1: mostCompatible.competitor1,
		competitor2: mostCompatible.competitor2,
		score: mostCompatible.score?.toFixed(2),
		avgAToB: mostCompatible.avgAToB,
		avgBToA: mostCompatible.avgBToA,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames,
		tiedPairs: isTied ? tiedPairs : null
	};
};

// Calculate least compatible pair of competitors
export const calculateLeastCompatible = (votes, submissions, competitors) => {
	// Same setup as most compatible
	const submissionToSubmitter = {};
	submissions.forEach(submission => {
		submissionToSubmitter[submission['Spotify URI']] = submission['Submitter ID'];
	});

	const voteMatrix = {};
	const submissionCounts = {};

	votes.forEach(vote => {
		const voterId = vote['Voter ID'];
		const submissionUri = vote['Spotify URI'];
		const submitterId = submissionToSubmitter[submissionUri];
		const points = parseInt(vote['Points Assigned'] || 0);

		// Skip self-votes
		if (voterId === submitterId) return;

		// Initialize matrix entries if they don't exist
		if (!voteMatrix[voterId]) voteMatrix[voterId] = {};
		if (!voteMatrix[voterId][submitterId]) voteMatrix[voterId][submitterId] = 0;

		// Count votes
		voteMatrix[voterId][submitterId] += points;

		// Count submissions
		if (!submissionCounts[submitterId]) submissionCounts[submitterId] = new Set();
		submissionCounts[submitterId].add(submissionUri);
	});

	// Calculate compatibility scores (average points given) for all pairs
	const allCompatibilityScores = [];
	const processedPairs = new Set(); // Track which pairs we've already processed

	Object.keys(voteMatrix).forEach(personA => {
		Object.keys(voteMatrix[personA] || {}).forEach(personB => {
			// Skip if B didn't vote for A (we need bidirectional compatibility)
			if (!voteMatrix[personB] || !voteMatrix[personB][personA]) return;

			// Create a unique key for the pair (sorted by ID to ensure consistency)
			const pairKey = [personA, personB].sort().join('|');

			// Skip if we've already processed this pair
			if (processedPairs.has(pairKey)) return;
			processedPairs.add(pairKey);

			const pointsAToB = voteMatrix[personA][personB];
			const pointsBToA = voteMatrix[personB][personA];

			const submissionsA = submissionCounts[personA]?.size || 0;
			const submissionsB = submissionCounts[personB]?.size || 0;

			// Skip if too few submissions
			if (submissionsA < 3 || submissionsB < 3) return;

			// Calculate average points (compatibility score)
			const avgAToB = pointsAToB / submissionsB;
			const avgBToA = pointsBToA / submissionsA;

			// Use the geometric mean for overall compatibility
			const compatibility = Math.sqrt(avgAToB * avgBToA);

			const person1 = competitors.find(comp => comp.ID === personA);
			const person2 = competitors.find(comp => comp.ID === personB);

			if (person1 && person2) {
				allCompatibilityScores.push({
					competitor1: person1,
					competitor2: person2,
					score: compatibility,
					avgAToB: avgAToB.toFixed(2),
					avgBToA: avgBToA.toFixed(2),
					pairKey: pairKey // Store the pairKey for later reference
				});
			}
		});
	});

	// Sort pairs by compatibility score (ascending for least compatible)
	allCompatibilityScores.sort((a, b) => a.score - b.score);

	// Check for ties (multiple pairs with the same lowest compatibility score)
	const lowestScore = allCompatibilityScores[0]?.score;
	const tiedPairs = allCompatibilityScores.filter(item => item.score === lowestScore);
	const isTied = tiedPairs.length > 1;

	// The least compatible pair is the first item in the sorted array
	const leastCompatible = allCompatibilityScores[0] || {};

	// Get tied pairs' names if there's a tie
	const tiedWinnersNames = isTied ? tiedPairs.map(item =>
		`${item.competitor1.Name} & ${item.competitor2.Name}`
	) : null;

	// Rest of the field (excluding the tied pairs if there's a tie)
	const restOfField = isTied
		? allCompatibilityScores.filter(item => item.score !== lowestScore).slice(0, 8).map(item => ({
			name: `${item.competitor1.Name} & ${item.competitor2.Name}`,
			score: `Score: ${item.score.toFixed(2)}`
		}))
		: allCompatibilityScores.slice(1, 9).map(item => ({
			name: `${item.competitor1.Name} & ${item.competitor2.Name}`,
			score: `Score: ${item.score.toFixed(2)}`
		}));

	return {
		competitor1: leastCompatible.competitor1,
		competitor2: leastCompatible.competitor2,
		score: leastCompatible.score?.toFixed(2),
		avgAToB: leastCompatible.avgAToB,
		avgBToA: leastCompatible.avgBToA,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames,
		tiedPairs: isTied ? tiedPairs : null
	};
};

// Calculate voting similarity between competitors
export const calculateVotingSimilarity = (votes, submissions, competitors) => {
	// Build a map of submissions to rounds
	const submissionToRound = {};
	submissions.forEach(submission => {
		submissionToRound[submission['Spotify URI']] = submission['Round ID'];
	});

	// Create a mapping of voter -> round -> submission -> points
	const votingPatterns = {};

	votes.forEach(vote => {
		const voterId = vote['Voter ID'];
		const submissionUri = vote['Spotify URI'];
		const roundId = submissionToRound[submissionUri];
		const points = parseInt(vote['Points Assigned'] || 0);

		if (!votingPatterns[voterId]) votingPatterns[voterId] = {};
		if (!votingPatterns[voterId][roundId]) votingPatterns[voterId][roundId] = {};

		votingPatterns[voterId][roundId][submissionUri] = points;
	});

	// Calculate similarity scores between voters
	const similarityScores = [];
	const processedPairs = new Set(); // Track which pairs we've already processed

	competitors.forEach(competitorA => {
		const voterIdA = competitorA.ID;

		competitors.forEach(competitorB => {
			const voterIdB = competitorB.ID;

			// Skip self-comparisons
			if (voterIdA === voterIdB) return;

			// Create pair key (sort to ensure consistent ordering)
			const pairKey = [voterIdA, voterIdB].sort().join('|');

			// Skip if we've already processed this pair
			if (processedPairs.has(pairKey)) return;
			processedPairs.add(pairKey);

			let totalDiff = 0;
			let submissionCount = 0;

			// Compare votes in each round
			Object.keys(votingPatterns[voterIdA] || {}).forEach(roundId => {
				// Skip if either voter didn't vote in this round
				if (!votingPatterns[voterIdB] || !votingPatterns[voterIdB][roundId]) return;

				// Find submissions that both voted on
				const submissionsA = votingPatterns[voterIdA][roundId];
				const submissionsB = votingPatterns[voterIdB][roundId];

				Object.keys(submissionsA).forEach(subUri => {
					if (submissionsB[subUri] !== undefined) {
						// Calculate absolute difference in points
						const diff = Math.abs(submissionsA[subUri] - submissionsB[subUri]);
						totalDiff += diff;
						submissionCount++;
					}
				});
			});

			// Calculate average difference (if they voted on enough common submissions)
			if (submissionCount >= 5) {
				const avgDiff = totalDiff / submissionCount;
				// Similarity is inverse of difference (5 - avgDiff gives a higher score for more similar)
				const similarity = Math.max(5 - avgDiff, 0);

				similarityScores.push({
					pairKey,
					competitor1: competitorA,
					competitor2: competitorB,
					similarity,
					votesCompared: submissionCount,
					avgDiff: avgDiff.toFixed(2)
				});
			}
		});
	});

	// Sort for most similar (descending)
	const sortedBySimilarity = [...similarityScores].sort((a, b) => b.similarity - a.similarity);

	// Check for ties in most similar (multiple pairs with the same highest similarity)
	const highestSimilarity = sortedBySimilarity[0]?.similarity;
	const tiedMostSimilar = sortedBySimilarity.filter(item => item.similarity === highestSimilarity);
	const isMostSimilarTied = tiedMostSimilar.length > 1;

	// The most similar pair is the first item in the sorted array
	const mostSimilar = sortedBySimilarity[0] || {};

	// Get tied most similar pairs' names if there's a tie
	const tiedMostSimilarNames = isMostSimilarTied ? tiedMostSimilar.map(item =>
		`${item.competitor1.Name} & ${item.competitor2.Name}`
	) : null;

	// Rest of the field for most similar (excluding the tied pairs if there's a tie)
	const mostSimilarRestOfField = isMostSimilarTied
		? sortedBySimilarity.filter(item => item.similarity !== highestSimilarity).slice(0, 8).map(item => ({
			name: `${item.competitor1.Name} & ${item.competitor2.Name}`,
			score: `Similarity: ${item.similarity.toFixed(2)}`
		}))
		: sortedBySimilarity.slice(1, 9).map(item => ({
			name: `${item.competitor1.Name} & ${item.competitor2.Name}`,
			score: `Similarity: ${item.similarity.toFixed(2)}`
		}));

	// Sort for least similar (ascending)
	const sortedByDissimilarity = [...similarityScores].sort((a, b) => a.similarity - b.similarity);

	// Check for ties in least similar (multiple pairs with the same lowest similarity)
	const lowestSimilarity = sortedByDissimilarity[0]?.similarity;
	const tiedLeastSimilar = sortedByDissimilarity.filter(item => item.similarity === lowestSimilarity);
	const isLeastSimilarTied = tiedLeastSimilar.length > 1;

	// The least similar pair is the first item in the sorted array
	const leastSimilar = sortedByDissimilarity[0] || {};

	// Get tied least similar pairs' names if there's a tie
	const tiedLeastSimilarNames = isLeastSimilarTied ? tiedLeastSimilar.map(item =>
		`${item.competitor1.Name} & ${item.competitor2.Name}`
	) : null;

	// Rest of the field for least similar (excluding the tied pairs if there's a tie)
	const leastSimilarRestOfField = isLeastSimilarTied
		? sortedByDissimilarity.filter(item => item.similarity !== lowestSimilarity).slice(0, 8).map(item => ({
			name: `${item.competitor1.Name} & ${item.competitor2.Name}`,
			score: `Similarity: ${item.similarity.toFixed(2)}`
		}))
		: sortedByDissimilarity.slice(1, 9).map(item => ({
			name: `${item.competitor1.Name} & ${item.competitor2.Name}`,
			score: `Similarity: ${item.similarity.toFixed(2)}`
		}));

	return {
		mostSimilar: {
			competitor1: mostSimilar.competitor1,
			competitor2: mostSimilar.competitor2,
			score: mostSimilar.similarity?.toFixed(2),
			votesCompared: mostSimilar.votesCompared,
			avgDiff: mostSimilar.avgDiff,
			restOfField: mostSimilarRestOfField,
			isTied: isMostSimilarTied,
			tiedWinners: tiedMostSimilarNames,
			tiedPairs: isMostSimilarTied ? tiedMostSimilar : null
		},
		leastSimilar: {
			competitor1: leastSimilar.competitor1,
			competitor2: leastSimilar.competitor2,
			score: leastSimilar.similarity?.toFixed(2),
			votesCompared: leastSimilar.votesCompared,
			avgDiff: leastSimilar.avgDiff,
			restOfField: leastSimilarRestOfField,
			isTied: isLeastSimilarTied,
			tiedWinners: tiedLeastSimilarNames,
			tiedPairs: isLeastSimilarTied ? tiedLeastSimilar : null
		}
	};
};

// Calculate who votes early most often
export const calculateEarlyVoter = (votes, competitors) => {
	// Group votes by round
	const votesByRound = {};

	votes.forEach(vote => {
		const roundId = vote['Round ID'];
		const voterId = vote['Voter ID'];
		const created = new Date(vote['Created']);

		if (!votesByRound[roundId]) votesByRound[roundId] = [];

		votesByRound[roundId].push({
			voterId,
			created
		});
	});

	// Count early votes by voter
	const earlyVoteCount = {};

	Object.values(votesByRound).forEach(roundVotes => {
		// Sort votes by creation time
		roundVotes.sort((a, b) => a.created - b.created);

		// Consider the first 25% "early"
		const earlyVoteEnd = Math.ceil(roundVotes.length * 0.25);

		// Count early votes for each voter
		roundVotes.slice(0, earlyVoteEnd).forEach(vote => {
			earlyVoteCount[vote.voterId] = (earlyVoteCount[vote.voterId] || 0) + 1;
		});
	});

	// Convert to array for sorting
	const competitorsWithEarlyVotes = Object.entries(earlyVoteCount).map(([voterId, count]) => {
		const competitor = competitors.find(c => c.ID === voterId);
		return {
			competitor,
			earlyVotes: count
		};
	}).filter(item => item.competitor); // Filter out any undefined competitors

	// Sort by early vote count (descending)
	competitorsWithEarlyVotes.sort((a, b) => b.earlyVotes - a.earlyVotes);

	// Check for ties (multiple competitors with the same early vote count)
	const highestCount = competitorsWithEarlyVotes[0]?.earlyVotes;
	const tiedWinners = competitorsWithEarlyVotes.filter(item => item.earlyVotes === highestCount);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithEarlyVotes[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding the tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithEarlyVotes.filter(item => item.earlyVotes !== highestCount).map(item => ({
			name: item.competitor.Name,
			score: `${item.earlyVotes} early votes`
		}))
		: competitorsWithEarlyVotes.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.earlyVotes} early votes`
		}));

	return {
		competitor: winner?.competitor,
		earlyVotes: winner?.earlyVotes,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate who votes last most often
export const calculateLateVoter = (votes, competitors) => {
	// Group votes by round
	const votesByRound = {};

	votes.forEach(vote => {
		const roundId = vote['Round ID'];
		const voterId = vote['Voter ID'];
		const created = new Date(vote['Created']);

		if (!votesByRound[roundId]) votesByRound[roundId] = [];

		votesByRound[roundId].push({
			voterId,
			created
		});
	});

	// Count late votes by voter
	const lateVoteCount = {};

	Object.values(votesByRound).forEach(roundVotes => {
		// Sort votes by creation time
		roundVotes.sort((a, b) => a.created - b.created);

		// If there are enough votes, consider the last 25% "late"
		const lateVoteStart = Math.max(0, roundVotes.length - Math.floor(roundVotes.length * 0.25));

		// Count late votes for each voter
		roundVotes.slice(lateVoteStart).forEach(vote => {
			lateVoteCount[vote.voterId] = (lateVoteCount[vote.voterId] || 0) + 1;
		});
	});

	// Convert to array for sorting
	const competitorsWithLateVotes = Object.entries(lateVoteCount).map(([voterId, count]) => {
		const competitor = competitors.find(c => c.ID === voterId);
		return {
			competitor,
			lateVotes: count
		};
	}).filter(item => item.competitor); // Filter out any undefined competitors

	// Sort by late vote count (descending)
	competitorsWithLateVotes.sort((a, b) => b.lateVotes - a.lateVotes);

	// Check for ties (multiple competitors with the same late vote count)
	const highestCount = competitorsWithLateVotes[0]?.lateVotes;
	const tiedWinners = competitorsWithLateVotes.filter(item => item.lateVotes === highestCount);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithLateVotes[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding the tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithLateVotes.filter(item => item.lateVotes !== highestCount).map(item => ({
			name: item.competitor.Name,
			score: `${item.lateVotes} late votes`
		}))
		: competitorsWithLateVotes.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.lateVotes} late votes`
		}));

	return {
		competitor: winner?.competitor,
		lateVotes: winner?.lateVotes,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate the competitor with highest average song popularity (Crowd Pleaser)
export const calculateCrowdPleaser = (submissions, competitors) => {
	// Group submissions by submitter
	const submissionsBySubmitter = {};

	submissions.forEach(submission => {
		const submitterId = submission['Submitter ID'];
		if (!submissionsBySubmitter[submitterId]) {
			submissionsBySubmitter[submitterId] = [];
		}
		submissionsBySubmitter[submitterId].push(submission);
	});

	// Calculate average popularity for each submitter (who has at least 3 submissions)
	const competitorsWithAvgPopularity = [];

	Object.entries(submissionsBySubmitter).forEach(([submitterId, submitterSubmissions]) => {
		// Only consider submitters with enough submissions and with popularity data
		const submissionsWithPopularity = submitterSubmissions.filter(
			submission => submission.popularity !== null && submission.popularity !== undefined
		);

		if (submissionsWithPopularity.length >= 3) {
			const totalPopularity = submissionsWithPopularity.reduce(
				(sum, submission) => sum + submission.popularity, 0
			);
			const avgPopularity = totalPopularity / submissionsWithPopularity.length;

			const competitor = competitors.find(comp => comp.ID === submitterId);
			if (competitor) {
				competitorsWithAvgPopularity.push({
					competitor,
					avgPopularity,
					submissionCount: submissionsWithPopularity.length
				});
			}
		}
	});

	// Sort by average popularity (highest first)
	competitorsWithAvgPopularity.sort((a, b) => b.avgPopularity - a.avgPopularity);

	// Check for ties (multiple competitors with the same highest average)
	const highestAvg = competitorsWithAvgPopularity[0]?.avgPopularity;
	const tiedWinners = competitorsWithAvgPopularity.filter(item => item.avgPopularity === highestAvg);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithAvgPopularity[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithAvgPopularity.filter(item => item.avgPopularity !== highestAvg).map(item => ({
			name: item.competitor.Name,
			score: `${item.avgPopularity.toFixed(1)} / 100 (${item.submissionCount} submissions)`
		}))
		: competitorsWithAvgPopularity.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.avgPopularity.toFixed(1)} / 100 (${item.submissionCount} submissions)`
		}));

	return {
		competitor: winner?.competitor,
		avgPopularity: winner?.avgPopularity.toFixed(1),
		submissionCount: winner?.submissionCount,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate the competitor with lowest average song popularity (Trend Setter)
export const calculateTrendSetter = (submissions, competitors) => {
	// Group submissions by submitter
	const submissionsBySubmitter = {};

	submissions.forEach(submission => {
		const submitterId = submission['Submitter ID'];
		if (!submissionsBySubmitter[submitterId]) {
			submissionsBySubmitter[submitterId] = [];
		}
		submissionsBySubmitter[submitterId].push(submission);
	});

	// Calculate average popularity for each submitter (who has at least 3 submissions)
	const competitorsWithAvgPopularity = [];

	Object.entries(submissionsBySubmitter).forEach(([submitterId, submitterSubmissions]) => {
		// Only consider submitters with enough submissions and with popularity data
		const submissionsWithPopularity = submitterSubmissions.filter(
			submission => submission.popularity !== null && submission.popularity !== undefined
		);

		if (submissionsWithPopularity.length >= 3) {
			const totalPopularity = submissionsWithPopularity.reduce(
				(sum, submission) => sum + submission.popularity, 0
			);
			const avgPopularity = totalPopularity / submissionsWithPopularity.length;

			const competitor = competitors.find(comp => comp.ID === submitterId);
			if (competitor) {
				competitorsWithAvgPopularity.push({
					competitor,
					avgPopularity,
					submissionCount: submissionsWithPopularity.length
				});
			}
		}
	});

	// Sort by average popularity (lowest first)
	competitorsWithAvgPopularity.sort((a, b) => a.avgPopularity - b.avgPopularity);

	// Check for ties (multiple competitors with the same lowest average)
	const lowestAvg = competitorsWithAvgPopularity[0]?.avgPopularity;
	const tiedWinners = competitorsWithAvgPopularity.filter(item => item.avgPopularity === lowestAvg);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithAvgPopularity[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithAvgPopularity.filter(item => item.avgPopularity !== lowestAvg).map(item => ({
			name: item.competitor.Name,
			score: `${item.avgPopularity.toFixed(1)} / 100 (${item.submissionCount} submissions)`
		}))
		: competitorsWithAvgPopularity.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.avgPopularity.toFixed(1)} / 100 (${item.submissionCount} submissions)`
		}));

	return {
		competitor: winner?.competitor,
		avgPopularity: winner?.avgPopularity.toFixed(1),
		submissionCount: winner?.submissionCount,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate all superlatives at once
export const calculateAllSuperlatives = (data) => {
	const { competitors, rounds, submissions, votes } = data;

	const mostPopular = calculateMostPopular(votes, submissions, competitors);
	const leastPopular = calculateLeastPopular(votes, submissions, competitors);
	const mostAverage = calculateMostAverage(votes, submissions, competitors);
	const bestPerformance = calculateBestPerformance(votes, submissions, competitors, rounds);
	const longestComment = calculateLongestComment(votes, submissions, competitors);
	const mostComments = calculateMostComments(votes, competitors);
	const mostCompatible = calculateMostCompatible(votes, submissions, competitors);
	const leastCompatible = calculateLeastCompatible(votes, submissions, competitors);
	const similarity = calculateVotingSimilarity(votes, submissions, competitors);
	const earlyVoter = calculateEarlyVoter(votes, competitors);
	const lateVoter = calculateLateVoter(votes, competitors);
	const crowdPleaser = calculateCrowdPleaser(submissions, competitors);
	const trendSetter = calculateTrendSetter(submissions, competitors);

	return {
		mostPopular,
		leastPopular,
		mostAverage,
		bestPerformance,
		longestComment,
		mostComments,
		compatibility: {
			mostCompatible,
			leastCompatible
		},
		similarity,
		votingTiming: {
			earlyVoter,
			lateVoter
		},
		spotify: {
			crowdPleaser,
			trendSetter
		}
	};
}; 