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

// Calculate most popular competitor (most total votes received)
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
	// Group votes by round and voter
	const votesByRoundAndVoter = {};
	const voterTimestampsByRound = {};

	// Organize votes by round and capture each voter's earliest timestamp per round
	votes.forEach(vote => {
		const roundId = vote['Round ID'];
		const voterId = vote['Voter ID'];
		const created = new Date(vote['Created']);

		// Track earliest vote timestamp for each voter in each round
		if (!voterTimestampsByRound[roundId]) {
			voterTimestampsByRound[roundId] = {};
		}

		if (!voterTimestampsByRound[roundId][voterId] || created < voterTimestampsByRound[roundId][voterId]) {
			voterTimestampsByRound[roundId][voterId] = created;
		}
	});

	// Count early voting rounds by voter
	const earlyRoundCount = {};

	Object.entries(voterTimestampsByRound).forEach(([roundId, voterTimestamps]) => {
		// Convert to array of {voterId, timestamp} for sorting
		const timestamps = Object.entries(voterTimestamps).map(([voterId, timestamp]) => ({
			voterId,
			timestamp
		}));

		// Sort by timestamp (earliest first)
		timestamps.sort((a, b) => a.timestamp - b.timestamp);

		// Consider the first 25% "early voters" for this round
		const earlyVoterCount = Math.ceil(timestamps.length * 0.25);

		// Count early rounds for each voter
		timestamps.slice(0, earlyVoterCount).forEach(vote => {
			earlyRoundCount[vote.voterId] = (earlyRoundCount[vote.voterId] || 0) + 1;
		});
	});

	// Convert to array for sorting
	const competitorsWithEarlyRounds = Object.entries(earlyRoundCount).map(([voterId, count]) => {
		const competitor = competitors.find(c => c.ID === voterId);
		return {
			competitor,
			earlyRounds: count
		};
	}).filter(item => item.competitor); // Filter out any undefined competitors

	// Sort by early round count (descending)
	competitorsWithEarlyRounds.sort((a, b) => b.earlyRounds - a.earlyRounds);

	// Check for ties (multiple competitors with the same early round count)
	const highestCount = competitorsWithEarlyRounds[0]?.earlyRounds;
	const tiedWinners = competitorsWithEarlyRounds.filter(item => item.earlyRounds === highestCount);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithEarlyRounds[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding the tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithEarlyRounds.filter(item => item.earlyRounds !== highestCount).map(item => ({
			name: item.competitor.Name,
			score: `${item.earlyRounds} rounds`
		}))
		: competitorsWithEarlyRounds.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.earlyRounds} rounds`
		}));

	return {
		competitor: winner?.competitor,
		earlyRounds: winner?.earlyRounds,
		description: "Awarded to the competitor who most frequently submitted votes within the first 25% of voting periods",
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate who votes last most often
export const calculateLateVoter = (votes, competitors) => {
	// Group votes by round and voter
	const voterTimestampsByRound = {};

	// Organize votes by round and capture each voter's timestamp per round
	votes.forEach(vote => {
		const roundId = vote['Round ID'];
		const voterId = vote['Voter ID'];
		const created = new Date(vote['Created']);

		// Track vote timestamp for each voter in each round (save the latest timestamp)
		if (!voterTimestampsByRound[roundId]) {
			voterTimestampsByRound[roundId] = {};
		}

		if (!voterTimestampsByRound[roundId][voterId] || created > voterTimestampsByRound[roundId][voterId]) {
			voterTimestampsByRound[roundId][voterId] = created;
		}
	});

	// Count late voting rounds by voter
	const lateRoundCount = {};

	Object.entries(voterTimestampsByRound).forEach(([roundId, voterTimestamps]) => {
		// Convert to array of {voterId, timestamp} for sorting
		const timestamps = Object.entries(voterTimestamps).map(([voterId, timestamp]) => ({
			voterId,
			timestamp
		}));

		// Sort by timestamp (latest last)
		timestamps.sort((a, b) => a.timestamp - b.timestamp);

		// Consider the last 25% "late voters" for this round
		const voterCount = timestamps.length;
		const lateVoterStart = Math.max(0, voterCount - Math.ceil(voterCount * 0.25));

		// Count late rounds for each voter
		timestamps.slice(lateVoterStart).forEach(vote => {
			lateRoundCount[vote.voterId] = (lateRoundCount[vote.voterId] || 0) + 1;
		});
	});

	// Convert to array for sorting
	const competitorsWithLateRounds = Object.entries(lateRoundCount).map(([voterId, count]) => {
		const competitor = competitors.find(c => c.ID === voterId);
		return {
			competitor,
			lateRounds: count
		};
	}).filter(item => item.competitor); // Filter out any undefined competitors

	// Sort by late round count (descending)
	competitorsWithLateRounds.sort((a, b) => b.lateRounds - a.lateRounds);

	// Check for ties (multiple competitors with the same late round count)
	const highestCount = competitorsWithLateRounds[0]?.lateRounds;
	const tiedWinners = competitorsWithLateRounds.filter(item => item.lateRounds === highestCount);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithLateRounds[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding the tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithLateRounds.filter(item => item.lateRounds !== highestCount).map(item => ({
			name: item.competitor.Name,
			score: `${item.lateRounds} rounds`
		}))
		: competitorsWithLateRounds.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.lateRounds} rounds`
		}));

	return {
		competitor: winner?.competitor,
		lateRounds: winner?.lateRounds,
		description: "Awarded to the competitor who most frequently submitted votes within the last 25% of voting periods",
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate the competitor with highest average song popularity (Mainstream)
export const calculateMainstream = (submissions, competitors) => {
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
			score: `${item.avgPopularity.toFixed(1)}`
		}))
		: competitorsWithAvgPopularity.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.avgPopularity.toFixed(1)}`
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
			score: `${item.avgPopularity.toFixed(1)}`
		}))
		: competitorsWithAvgPopularity.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.avgPopularity.toFixed(1)}`
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

// Calculate the competitor who spreads their points most evenly (Vote Spreader)
export const calculateVoteSpreader = (votes, competitors) => {
	// Group individual points by voter (each point counts as a separate vote)
	const individualVotesByVoter = {};

	votes.forEach(vote => {
		const voterId = vote['Voter ID'];
		const points = parseInt(vote['Points Assigned'] || 0);

		if (!individualVotesByVoter[voterId]) {
			individualVotesByVoter[voterId] = [];
		}

		// Add individual points as separate votes
		// For example, if someone gives 3 points, add three 1-point votes
		for (let i = 0; i < points; i++) {
			individualVotesByVoter[voterId].push(1);
		}
	});

	// Calculate standard deviation for each voter (lower = more even distribution)
	const competitorsWithSpreadScores = [];

	Object.entries(individualVotesByVoter).forEach(([voterId, voterPoints]) => {
		// Only consider voters with enough votes (at least 30 individual votes)
		if (voterPoints.length >= 30) {
			// Calculate mean (should be 1 since each individual vote is worth 1 point)
			const mean = voterPoints.reduce((sum, points) => sum + points, 0) / voterPoints.length;

			// Calculate standard deviation (should be 0 for perfectly even distribution)
			const variance = voterPoints.reduce((sum, points) => sum + Math.pow(points - mean, 2), 0) / voterPoints.length;
			const standardDeviation = Math.sqrt(variance);

			// For this metric, we want to measure how evenly they distribute their ORIGINAL votes
			// So let's recalculate using the original vote values
			const originalVotes = [];
			votes.forEach(vote => {
				if (vote['Voter ID'] === voterId) {
					originalVotes.push(parseInt(vote['Points Assigned'] || 0));
				}
			});

			if (originalVotes.length >= 10) {
				const originalMean = originalVotes.reduce((sum, points) => sum + points, 0) / originalVotes.length;
				const originalVariance = originalVotes.reduce((sum, points) => sum + Math.pow(points - originalMean, 2), 0) / originalVotes.length;
				const originalStandardDeviation = Math.sqrt(originalVariance);

				// Lower standard deviation = more even distribution
				// We'll use the inverse for scoring (higher score = more even)
				const spreadScore = 1 / (originalStandardDeviation + 0.1); // Add 0.1 to avoid division by zero

				const competitor = competitors.find(comp => comp.ID === voterId);
				if (competitor) {
					competitorsWithSpreadScores.push({
						competitor,
						spreadScore,
						standardDeviation: originalStandardDeviation,
						meanPoints: originalMean,
						totalVotes: voterPoints.length // This is now the total individual votes given
					});
				}
			}
		}
	});

	// Sort by spread score (highest first = most even distribution)
	competitorsWithSpreadScores.sort((a, b) => b.spreadScore - a.spreadScore);

	// Check for ties (multiple competitors with the same spread score)
	const highestSpreadScore = competitorsWithSpreadScores[0]?.spreadScore;
	const tiedWinners = competitorsWithSpreadScores.filter(item =>
		Math.abs(item.spreadScore - highestSpreadScore) < 0.01 // Small tolerance for floating point comparison
	);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithSpreadScores[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithSpreadScores.filter(item =>
			Math.abs(item.spreadScore - highestSpreadScore) >= 0.01
		).map(item => ({
			name: item.competitor.Name,
			score: `Std Dev: ${item.standardDeviation.toFixed(2)} (${item.totalVotes} votes)`
		}))
		: competitorsWithSpreadScores.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `Std Dev: ${item.standardDeviation.toFixed(2)} (${item.totalVotes} votes)`
		}));

	return {
		competitor: winner?.competitor,
		standardDeviation: winner?.standardDeviation.toFixed(2),
		meanPoints: winner?.meanPoints.toFixed(2),
		totalVotes: winner?.totalVotes,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate the competitor who gives the most zero-point votes (Zero-Vote Giver)
export const calculateZeroVoteGiver = (votes, competitors) => {
	// Count zero votes and total individual votes by voter
	const zeroVotesByVoter = {};
	const totalIndividualVotesByVoter = {};

	votes.forEach(vote => {
		const voterId = vote['Voter ID'];
		const points = parseInt(vote['Points Assigned'] || 0);

		// Initialize counters
		if (!zeroVotesByVoter[voterId]) zeroVotesByVoter[voterId] = 0;
		if (!totalIndividualVotesByVoter[voterId]) totalIndividualVotesByVoter[voterId] = 0;

		// Count total individual votes (each point counts as one vote)
		totalIndividualVotesByVoter[voterId] += points;

		// Count zero votes (each zero-point submission counts as zero votes, so no change needed)
		if (points === 0) {
			zeroVotesByVoter[voterId]++;
		}
	});

	// Calculate zero vote percentages for competitors with enough votes
	const competitorsWithZeroVoteStats = [];

	Object.entries(zeroVotesByVoter).forEach(([voterId, zeroCount]) => {
		const totalIndividualVotes = totalIndividualVotesByVoter[voterId];

		// Only consider voters with at least 30 individual votes
		if (totalIndividualVotes >= 30) {
			// For percentage calculation, we need to consider that zero votes don't contribute to total
			// So we calculate: zero submissions / (zero submissions + individual votes given)
			const totalSubmissionsVotedOn = zeroCount + totalIndividualVotes;
			const zeroPercentage = (zeroCount / totalSubmissionsVotedOn) * 100;

			const competitor = competitors.find(comp => comp.ID === voterId);

			if (competitor) {
				competitorsWithZeroVoteStats.push({
					competitor,
					zeroCount,
					totalIndividualVotes,
					totalSubmissionsVotedOn,
					zeroPercentage
				});
			}
		}
	});

	// Sort by zero vote count (descending)
	competitorsWithZeroVoteStats.sort((a, b) => b.zeroCount - a.zeroCount);

	// Check for ties (multiple competitors with the same zero vote count)
	const highestZeroCount = competitorsWithZeroVoteStats[0]?.zeroCount;
	const tiedWinners = competitorsWithZeroVoteStats.filter(item => item.zeroCount === highestZeroCount);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithZeroVoteStats[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithZeroVoteStats.filter(item => item.zeroCount !== highestZeroCount).map(item => ({
			name: item.competitor.Name,
			score: `${item.zeroCount} zero votes (${item.zeroPercentage.toFixed(1)}% of ${item.totalSubmissionsVotedOn} submissions)`
		}))
		: competitorsWithZeroVoteStats.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.zeroCount} zero votes (${item.zeroPercentage.toFixed(1)}% of ${item.totalSubmissionsVotedOn} submissions)`
		}));

	return {
		competitor: winner?.competitor,
		zeroCount: winner?.zeroCount,
		totalVotes: winner?.totalIndividualVotes,
		totalSubmissionsVotedOn: winner?.totalSubmissionsVotedOn,
		zeroPercentage: winner?.zeroPercentage.toFixed(1),
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate the competitor who gives the most maximum-point votes (Max-Vote Giver)
export const calculateMaxVoteGiver = (votes, competitors) => {
	// Group votes by voter and round
	const votesByVoterAndRound = {};

	votes.forEach(vote => {
		const voterId = vote['Voter ID'];
		const roundId = vote['Round ID'];
		const points = parseInt(vote['Points Assigned'] || 0);

		if (!votesByVoterAndRound[voterId]) {
			votesByVoterAndRound[voterId] = {};
		}
		if (!votesByVoterAndRound[voterId][roundId]) {
			votesByVoterAndRound[voterId][roundId] = [];
		}

		votesByVoterAndRound[voterId][roundId].push({
			points,
			submissionUri: vote['Spotify URI']
		});
	});

	// Calculate "all-in" rounds for each voter
	const competitorsWithAllInStats = [];

	Object.entries(votesByVoterAndRound).forEach(([voterId, roundVotes]) => {
		const competitor = competitors.find(comp => comp.ID === voterId);
		if (!competitor) return;

		const rounds = Object.keys(roundVotes);

		// Only consider voters who participated in at least 3 rounds
		if (rounds.length < 3) return;

		let allInRounds = 0;

		rounds.forEach(roundId => {
			const votesInRound = roundVotes[roundId];

			// Calculate total points available in this round
			const totalPointsInRound = votesInRound.reduce((sum, vote) => sum + vote.points, 0);

			// Skip rounds where no points were assigned
			if (totalPointsInRound === 0) return;

			// Check if all points went to a single submission
			const pointsBySubmission = {};
			votesInRound.forEach(vote => {
				if (!pointsBySubmission[vote.submissionUri]) {
					pointsBySubmission[vote.submissionUri] = 0;
				}
				pointsBySubmission[vote.submissionUri] += vote.points;
			});

			// Find the maximum points given to any single submission
			const maxPointsToSingleSubmission = Math.max(...Object.values(pointsBySubmission));

			// If all points went to one submission, count it as an "all-in" round
			if (maxPointsToSingleSubmission === totalPointsInRound) {
				allInRounds++;
			}
		});

		const allInPercentage = (allInRounds / rounds.length) * 100;

		competitorsWithAllInStats.push({
			competitor,
			allInRounds,
			totalRounds: rounds.length,
			allInPercentage
		});
	});

	// Sort by all-in percentage (descending), then by number of all-in rounds
	competitorsWithAllInStats.sort((a, b) => {
		if (Math.abs(a.allInPercentage - b.allInPercentage) < 0.1) {
			return b.allInRounds - a.allInRounds;
		}
		return b.allInPercentage - a.allInPercentage;
	});

	// Check for ties (multiple competitors with the same all-in percentage)
	const highestPercentage = competitorsWithAllInStats[0]?.allInPercentage;
	const tiedWinners = competitorsWithAllInStats.filter(item =>
		Math.abs(item.allInPercentage - highestPercentage) < 0.1
	);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithAllInStats[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithAllInStats.filter(item =>
			Math.abs(item.allInPercentage - highestPercentage) >= 0.1
		).map(item => ({
			name: item.competitor.Name,
			score: `${item.allInRounds}/${item.totalRounds} rounds (${item.allInPercentage.toFixed(1)}%)`
		}))
		: competitorsWithAllInStats.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.allInRounds}/${item.totalRounds} rounds (${item.allInPercentage.toFixed(1)}%)`
		}));

	return {
		competitor: winner?.competitor,
		allInRounds: winner?.allInRounds,
		totalRounds: winner?.totalRounds,
		allInPercentage: winner?.allInPercentage?.toFixed(1),
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate the competitor with the biggest comeback (Comeback Kid)
export const calculateComebackKid = (votes, submissions, competitors, rounds) => {
	// Group submissions by submitter and round
	const submissionsBySubmitterAndRound = {};
	const submissionData = {};

	submissions.forEach(submission => {
		const submitterId = submission['Submitter ID'];
		const roundId = submission['Round ID'];
		const spotifyUri = submission['Spotify URI'];

		if (!submissionsBySubmitterAndRound[submitterId]) {
			submissionsBySubmitterAndRound[submitterId] = {};
		}
		submissionsBySubmitterAndRound[submitterId][roundId] = spotifyUri;

		submissionData[spotifyUri] = {
			submitterId,
			roundId,
			title: submission['Title'],
			artist: submission['Artist(s)']
		};
	});

	// Calculate scores for each submission
	const scoresBySubmission = {};
	votes.forEach(vote => {
		const spotifyUri = vote['Spotify URI'];
		const points = parseInt(vote['Points Assigned'] || 0);

		if (!scoresBySubmission[spotifyUri]) {
			scoresBySubmission[spotifyUri] = 0;
		}
		scoresBySubmission[spotifyUri] += points;
	});

	// Calculate comeback scores for each competitor
	const comebackScores = [];

	Object.entries(submissionsBySubmitterAndRound).forEach(([submitterId, roundSubmissions]) => {
		const competitor = competitors.find(comp => comp.ID === submitterId);
		if (!competitor) return;

		// Get all rounds this competitor participated in
		const participatedRounds = Object.keys(roundSubmissions);

		// Need at least 3 rounds to calculate a meaningful comeback
		if (participatedRounds.length < 3) return;

		// Sort rounds by their actual order (using the order they appear in the rounds array/CSV)
		const roundsWithOrder = participatedRounds.map(roundId => {
			const round = rounds.find(r => r.ID === roundId);
			// Find the index of this round in the original rounds array (CSV order)
			const roundIndex = rounds.findIndex(r => r.ID === roundId);
			return {
				roundId,
				round,
				// Use the index in the rounds array for proper chronological ordering
				order: roundIndex >= 0 ? roundIndex : 999 // Put unknown rounds at the end
			};
		}).sort((a, b) => {
			// Sort by the order they appear in the rounds array (CSV order)
			return a.order - b.order;
		});

		// Calculate scores for each round in chronological order
		const roundScores = roundsWithOrder.map((roundInfo, index) => {
			const submissionUri = roundSubmissions[roundInfo.roundId];
			return {
				roundId: roundInfo.roundId,
				score: scoresBySubmission[submissionUri] || 0,
				submissionUri,
				chronologicalIndex: index // Track the chronological position
			};
		});

		// Find the best comeback by checking each potential low point
		let bestComeback = null;
		let bestComebackMagnitude = 0;

		roundScores.forEach((lowRound, lowIndex) => {
			// Look for the best score that comes AFTER this low point chronologically
			let bestSubsequentScore = lowRound.score;
			let bestSubsequentRoundIndex = lowIndex;

			for (let i = lowIndex + 1; i < roundScores.length; i++) {
				if (roundScores[i].score > bestSubsequentScore) {
					bestSubsequentScore = roundScores[i].score;
					bestSubsequentRoundIndex = i;
				}
			}

			// Calculate comeback magnitude for this potential low point
			const comebackMagnitude = bestSubsequentScore - lowRound.score;

			// Update best comeback if this is better and meaningful (at least 5 points)
			if (comebackMagnitude >= 5 && comebackMagnitude > bestComebackMagnitude) {
				const lowestRound = rounds.find(r => r.ID === roundScores[lowIndex].roundId);
				const bestRound = rounds.find(r => r.ID === roundScores[bestSubsequentRoundIndex].roundId);
				const lowestSubmission = submissionData[roundScores[lowIndex].submissionUri];
				const bestSubmission = submissionData[roundScores[bestSubsequentRoundIndex].submissionUri];

				bestComeback = {
					competitor,
					comebackMagnitude,
					lowestScore: lowRound.score,
					bestSubsequentScore,
					lowestRound,
					bestRound,
					lowestSubmission,
					bestSubmission,
					roundsParticipated: participatedRounds.length,
					lowRoundIndex: lowIndex,
					bestRoundIndex: bestSubsequentRoundIndex
				};
				bestComebackMagnitude = comebackMagnitude;
			}
		});

		// Add the best comeback for this competitor if one was found
		if (bestComeback) {
			comebackScores.push(bestComeback);
		}
	});

	// Sort by comeback magnitude (descending)
	comebackScores.sort((a, b) => b.comebackMagnitude - a.comebackMagnitude);

	// Check for ties (multiple competitors with the same comeback magnitude)
	const highestComeback = comebackScores[0]?.comebackMagnitude;
	const tiedWinners = comebackScores.filter(item => item.comebackMagnitude === highestComeback);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = comebackScores[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? comebackScores.filter(item => item.comebackMagnitude !== highestComeback).map(item => ({
			name: item.competitor.Name,
			score: `+${item.comebackMagnitude} points (${item.lowestScore} → ${item.bestSubsequentScore})`
		}))
		: comebackScores.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `+${item.comebackMagnitude} points (${item.lowestScore} → ${item.bestSubsequentScore})`
		}));

	return {
		competitor: winner?.competitor,
		comebackMagnitude: winner?.comebackMagnitude,
		lowestScore: winner?.lowestScore,
		bestSubsequentScore: winner?.bestSubsequentScore,
		lowestRound: winner?.lowestRound,
		bestRound: winner?.bestRound,
		lowestSubmission: winner?.lowestSubmission,
		bestSubmission: winner?.bestSubmission,
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames,
		tiedComebacks: isTied ? tiedWinners : null
	};
};

// Calculate the competitor who missed the most rounds of voting (Doesn't Often Vote)
export const calculateDoesntVote = (votes, competitors, rounds) => {
	// Filter out any empty or invalid rounds (Papa Parse sometimes includes empty rows)
	const validRounds = rounds.filter(round => round && round.ID && round.ID.trim() !== '');

	// Count rounds each competitor participated in
	const roundsParticipatedByCompetitor = {};

	votes.forEach(vote => {
		const voterId = vote['Voter ID'];
		const roundId = vote['Round ID'];

		if (!roundsParticipatedByCompetitor[voterId]) {
			roundsParticipatedByCompetitor[voterId] = new Set();
		}
		roundsParticipatedByCompetitor[voterId].add(roundId);
	});

	// Calculate missed rounds for each competitor
	const competitorsWithMissedRounds = [];
	const totalRounds = validRounds.length;

	competitors.forEach(competitor => {
		const competitorId = competitor.ID;
		const roundsParticipated = roundsParticipatedByCompetitor[competitorId]?.size || 0;
		const roundsMissed = totalRounds - roundsParticipated;

		// Only consider competitors who missed at least 1 round
		if (roundsMissed > 0) {
			competitorsWithMissedRounds.push({
				competitor,
				roundsMissed,
				roundsParticipated,
				totalRounds,
				missedPercentage: (roundsMissed / totalRounds) * 100
			});
		}
	});

	// Sort by rounds missed (descending)
	competitorsWithMissedRounds.sort((a, b) => b.roundsMissed - a.roundsMissed);

	// Check for ties (multiple competitors with the same number of missed rounds)
	const highestMissed = competitorsWithMissedRounds[0]?.roundsMissed;
	const tiedWinners = competitorsWithMissedRounds.filter(item => item.roundsMissed === highestMissed);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithMissedRounds[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithMissedRounds.filter(item => item.roundsMissed !== highestMissed).map(item => ({
			name: item.competitor.Name,
			score: `${item.roundsMissed}/${item.totalRounds} rounds missed (${item.missedPercentage.toFixed(1)}%)`
		}))
		: competitorsWithMissedRounds.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.roundsMissed}/${item.totalRounds} rounds missed (${item.missedPercentage.toFixed(1)}%)`
		}));

	return {
		competitor: winner?.competitor,
		roundsMissed: winner?.roundsMissed,
		roundsParticipated: winner?.roundsParticipated,
		totalRounds: winner?.totalRounds,
		missedPercentage: winner?.missedPercentage?.toFixed(1),
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
	const mainstream = calculateMainstream(submissions, competitors);
	const trendSetter = calculateTrendSetter(submissions, competitors);
	const voteSpreader = calculateVoteSpreader(votes, competitors);
	const zeroVoteGiver = calculateZeroVoteGiver(votes, competitors);
	const maxVoteGiver = calculateMaxVoteGiver(votes, competitors);
	const comebackKid = calculateComebackKid(votes, submissions, competitors, rounds);
	const doesntVote = calculateDoesntVote(votes, competitors, rounds);

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
			mainstream,
			trendSetter
		},
		voteSpreader,
		zeroVoteGiver,
		maxVoteGiver,
		comebackKid,
		doesntVote
	};
}; 