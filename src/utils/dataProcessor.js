import Papa from 'papaparse';
import { getTracksPopularity, extractTrackIdsFromUris } from './spotifyApi';

// Function to get available seasons dynamically
export const getAvailableSeasons = async (league = 'suit-and-tie') => {
	try {
		// Probe seasons progressively; stop after several consecutive misses.
		const availableSeasons = [];
		let index = 1;
		let misses = 0;
		const maxConsecutiveMisses = 3;
		const hardStop = 100; // safety cap

		while (index <= hardStop && misses < maxConsecutiveMisses) {
			const seasonId = `season${index}`;
			try {
				const res = await fetch(`/data/${league}/${seasonId}/competitors.csv`, { method: 'HEAD' });
				if (res.ok) {
					availableSeasons.push({ id: seasonId, label: `Season ${index}`, number: index });
					misses = 0;
				} else {
					misses++;
				}
			} catch (_e) {
				misses++;
			}
			index++;
		}

		return availableSeasons;
	} catch (error) {
		console.error('Error detecting available seasons:', error);
		return [];
	}
};

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

// Sanitize parsed CSV rows by filtering out empty rows and enforcing required fields
const sanitizeRows = (rows, requiredKeys = []) => {
	if (!Array.isArray(rows)) return [];
	return rows.filter((row) => {
		if (!row || typeof row !== 'object') return false;
		// Drop rows with all values empty/whitespace/null
		const hasAnyValue = Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
		if (!hasAnyValue) return false;
		// Enforce required keys when provided
		for (const key of requiredKeys) {
			if (!(key in row)) return false;
			const val = row[key];
			if (val === null || val === undefined || String(val).trim() === '') return false;
		}
		return true;
	});
};

const safeParseDate = (value) => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};

const mean = (values) => {
	if (!Array.isArray(values) || values.length === 0) return null;
	const total = values.reduce((sum, val) => sum + val, 0);
	return total / values.length;
};

const standardDeviation = (values) => {
	if (!Array.isArray(values) || values.length < 2) return 0;
	const avg = mean(values);
	const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (values.length - 1);
	return Math.sqrt(variance);
};

const rankArray = (values, { descending = false } = {}) => {
	if (!Array.isArray(values)) return [];
	const sorted = values
		.map((value, index) => ({ value, index }))
		.sort((a, b) => {
			if (a.value === b.value) return a.index - b.index;
			return descending ? b.value - a.value : a.value - b.value;
		});

	const ranks = new Array(values.length);
	let i = 0;
	while (i < sorted.length) {
		let j = i;
		while (j + 1 < sorted.length && sorted[j + 1].value === sorted[i].value) {
			j++;
		}
		const rankValue = (i + j + 2) / 2; // average rank (1-based)
		for (let k = i; k <= j; k++) {
			ranks[sorted[k].index] = rankValue;
		}
		i = j + 1;
	}
	return ranks;
};

const pearsonCorrelation = (x, y) => {
	if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < 2) return null;
	const meanX = mean(x);
	const meanY = mean(y);
	let sumXX = 0;
	let sumYY = 0;
	let sumXY = 0;

	for (let i = 0; i < x.length; i++) {
		const dx = x[i] - meanX;
		const dy = y[i] - meanY;
		sumXX += dx * dx;
		sumYY += dy * dy;
		sumXY += dx * dy;
	}

	const denominator = Math.sqrt(sumXX * sumYY);
	if (!denominator) return null;
	return sumXY / denominator;
};

const spearmanCorrelation = (x, y) => {
	if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < 3) return null;
	const rankX = rankArray(x);
	const rankY = rankArray(y);
	return pearsonCorrelation(rankX, rankY);
};

const erf = (x) => {
	// Abramowitz and Stegun formula 7.1.26
	const sign = x < 0 ? -1 : 1;
	const absX = Math.abs(x);

	const a1 = 0.254829592;
	const a2 = -0.284496736;
	const a3 = 1.421413741;
	const a4 = -1.453152027;
	const a5 = 1.061405429;
	const p = 0.3275911;

	const t = 1 / (1 + p * absX);
	const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
	return sign * y;
};

const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

const correlationPValue = (r, n) => {
	if (r === null || Number.isNaN(r) || !Number.isFinite(r) || !Number.isFinite(n) || n < 4) return null;
	const clampedR = Math.min(0.999999, Math.max(-0.999999, r));
	const fisherZ = 0.5 * Math.log((1 + clampedR) / (1 - clampedR));
	if (!Number.isFinite(fisherZ)) return null;
	const z = Math.abs(fisherZ) * Math.sqrt(Math.max(n - 3, 0));
	if (!Number.isFinite(z)) return null;
	const p = 2 * (1 - normalCdf(z));
	return Math.max(0, Math.min(1, p));
};

// Load all datasets
export const loadAllData = async (season = 'season1', league = 'suit-and-tie') => {
	try {
		const competitorsRaw = await loadCSV(`/data/${league}/${season}/competitors.csv`);
		const roundsRaw = await loadCSV(`/data/${league}/${season}/rounds.csv`);
		const submissionsRaw = await loadCSV(`/data/${league}/${season}/submissions.csv`);
		const votesRaw = await loadCSV(`/data/${league}/${season}/votes.csv`);

		// Sanitize all datasets to remove trailing/empty rows
		const competitors = sanitizeRows(competitorsRaw, ['ID', 'Name']);
		const rounds = sanitizeRows(roundsRaw, ['ID', 'Name']);
		const submissions = sanitizeRows(submissionsRaw, ['Spotify URI', 'Submitter ID', 'Round ID']);
		const votes = sanitizeRows(votesRaw, ['Voter ID', 'Round ID', 'Spotify URI']);

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
	const voterRoundCounts = {}; // Track how many rounds each voter participated in

	votes.forEach(vote => {
		const voterId = vote['Voter ID'];
		const submissionUri = vote['Spotify URI'];
		const roundId = submissionToRound[submissionUri];
		const points = parseInt(vote['Points Assigned'] || 0);

		if (!votingPatterns[voterId]) {
			votingPatterns[voterId] = {};
			voterRoundCounts[voterId] = new Set();
		}
		if (!votingPatterns[voterId][roundId]) votingPatterns[voterId][roundId] = {};

		votingPatterns[voterId][roundId][submissionUri] = points;
		voterRoundCounts[voterId].add(roundId);
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

			// Get participation counts
			const roundsA = voterRoundCounts[voterIdA]?.size || 0;
			const roundsB = voterRoundCounts[voterIdB]?.size || 0;

			// Participation balance safeguard: both players must have participated in at least 3 rounds
			// and their participation difference shouldn't be more than 50% of the lower count
			if (roundsA < 3 || roundsB < 3) return;

			const minRounds = Math.min(roundsA, roundsB);
			const maxRounds = Math.max(roundsA, roundsB);
			const participationRatio = minRounds / maxRounds;

			// Require at least 60% participation overlap to ensure fair comparison
			if (participationRatio < 0.6) return;

			let totalDiff = 0;
			let submissionCount = 0;
			let roundsCompared = 0;

			// Compare votes in each round
			Object.keys(votingPatterns[voterIdA] || {}).forEach(roundId => {
				// Skip if either voter didn't vote in this round
				if (!votingPatterns[voterIdB] || !votingPatterns[voterIdB][roundId]) return;

				roundsCompared++;

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

			// Enhanced minimum sample size: require at least 10 common votes and 3 common rounds
			if (submissionCount < 10 || roundsCompared < 3) return;

			// Calculate average difference and handle edge cases
			const avgDiff = submissionCount > 0 ? totalDiff / submissionCount : 0;

			// Enhanced similarity calculation with safeguards
			let similarity;
			if (avgDiff === 0) {
				// Perfect similarity case - they voted identically on all common songs
				similarity = 5.0;
			} else {
				// Similarity is inverse of difference, capped at 0
				similarity = Math.max(5 - avgDiff, 0);
			}

			// Additional safeguard: if similarity is NaN or undefined, skip this pair
			if (isNaN(similarity) || similarity === undefined) return;

			similarityScores.push({
				pairKey,
				competitor1: competitorA,
				competitor2: competitorB,
				similarity,
				votesCompared: submissionCount,
				roundsCompared,
				avgDiff: avgDiff.toFixed(2),
				participationA: roundsA,
				participationB: roundsB,
				participationRatio: participationRatio.toFixed(3)
			});
		});
	});

	// If no valid similarity scores were calculated, return empty results
	if (similarityScores.length === 0) {
		return {
			mostSimilar: {
				competitor1: null,
				competitor2: null,
				score: null,
				votesCompared: null,
				avgDiff: null,
				restOfField: [],
				isTied: false,
				tiedWinners: null,
				tiedPairs: null
			},
			leastSimilar: {
				competitor1: null,
				competitor2: null,
				score: null,
				votesCompared: null,
				avgDiff: null,
				restOfField: [],
				isTied: false,
				tiedWinners: null,
				tiedPairs: null
			}
		};
	}

	// Sort for most similar (descending)
	const sortedBySimilarity = [...similarityScores].sort((a, b) => b.similarity - a.similarity);

	// Check for ties in most similar (multiple pairs with the same highest similarity)
	const highestSimilarity = sortedBySimilarity[0]?.similarity;
	const tiedMostSimilar = sortedBySimilarity.filter(item =>
		Math.abs(item.similarity - highestSimilarity) < 0.01
	);
	const isMostSimilarTied = tiedMostSimilar.length > 1;

	// The most similar pair is the first item in the sorted array
	const mostSimilar = sortedBySimilarity[0] || {};

	// Get tied most similar pairs' names if there's a tie
	const tiedMostSimilarNames = isMostSimilarTied ? tiedMostSimilar.map(item =>
		`${item.competitor1.Name} & ${item.competitor2.Name}`
	) : null;

	// Rest of the field for most similar (excluding the tied pairs if there's a tie)
	const mostSimilarRestOfField = isMostSimilarTied
		? sortedBySimilarity.filter(item => Math.abs(item.similarity - highestSimilarity) >= 0.01).slice(0, 8).map(item => ({
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
	const tiedLeastSimilar = sortedByDissimilarity.filter(item =>
		Math.abs(item.similarity - lowestSimilarity) < 0.01
	);
	const isLeastSimilarTied = tiedLeastSimilar.length > 1;

	// The least similar pair is the first item in the sorted array
	const leastSimilar = sortedByDissimilarity[0] || {};

	// Get tied least similar pairs' names if there's a tie
	const tiedLeastSimilarNames = isLeastSimilarTied ? tiedLeastSimilar.map(item =>
		`${item.competitor1.Name} & ${item.competitor2.Name}`
	) : null;

	// Rest of the field for least similar (excluding the tied pairs if there's a tie)
	const leastSimilarRestOfField = isLeastSimilarTied
		? sortedByDissimilarity.filter(item => Math.abs(item.similarity - lowestSimilarity) >= 0.01).slice(0, 8).map(item => ({
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
export const calculateMaxVoteGiver = (votes, competitors, submissions) => {
	// Create a map of Spotify URIs to song details
	const submissionDetails = {};
	submissions.forEach(submission => {
		submissionDetails[submission['Spotify URI']] = {
			title: submission['Title'],
			artist: submission['Artist(s)'],
			submitterId: submission['Submitter ID']
		};
	});

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
		const allInExamples = []; // Store examples of all-in votes

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

				// Find which submission got all the votes
				const allInSubmissionUri = Object.keys(pointsBySubmission).find(
					uri => pointsBySubmission[uri] === totalPointsInRound
				);

				// Store example with song details
				if (allInSubmissionUri && submissionDetails[allInSubmissionUri]) {
					const songInfo = submissionDetails[allInSubmissionUri];
					allInExamples.push({
						roundId,
						points: totalPointsInRound,
						songTitle: songInfo.title,
						songArtist: songInfo.artist,
						submissionUri: allInSubmissionUri
					});
				}
			}
		});

		const allInPercentage = (allInRounds / rounds.length) * 100;

		competitorsWithAllInStats.push({
			competitor,
			allInRounds,
			totalRounds: rounds.length,
			allInPercentage,
			allInExamples // Include examples of all-in votes
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
		allInExamples: winner?.allInExamples || [], // Include examples for the winner
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames,
		tiedWinnersData: isTied ? tiedWinners : null // Include full data for tied winners
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
		// Validate that the competitor has required properties
		if (!competitor || !competitor.ID || !competitor.Name || competitor.Name.trim() === '') {
			return; // Skip invalid competitors
		}

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

	// If no valid competitors with missed rounds, return empty result
	if (competitorsWithMissedRounds.length === 0) {
		return {
			competitor: null,
			roundsMissed: null,
			roundsParticipated: null,
			totalRounds: totalRounds,
			missedPercentage: null,
			restOfField: [],
			isTied: false,
			tiedWinners: null
		};
	}

	// Sort by rounds missed (descending)
	competitorsWithMissedRounds.sort((a, b) => b.roundsMissed - a.roundsMissed);

	// Check for ties (multiple competitors with the same number of missed rounds)
	const highestMissed = competitorsWithMissedRounds[0]?.roundsMissed;
	const tiedWinners = competitorsWithMissedRounds.filter(item => item.roundsMissed === highestMissed);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithMissedRounds[0];

	// Additional validation for the winner
	if (!winner || !winner.competitor || !winner.competitor.Name) {
		return {
			competitor: null,
			roundsMissed: null,
			roundsParticipated: null,
			totalRounds: totalRounds,
			missedPercentage: null,
			restOfField: [],
			isTied: false,
			tiedWinners: null
		};
	}

	// Get tied winners' names if there's a tie - with validation
	const tiedWinnersNames = isTied ? tiedWinners
		.filter(item => item.competitor && item.competitor.Name) // Filter out invalid names
		.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie) - with validation
	const restOfField = isTied
		? competitorsWithMissedRounds
			.filter(item => item.roundsMissed !== highestMissed && item.competitor && item.competitor.Name)
			.map(item => ({
				name: item.competitor.Name,
				score: `${item.roundsMissed}/${item.totalRounds} rounds missed (${item.missedPercentage.toFixed(1)}%)`
			}))
		: competitorsWithMissedRounds
			.slice(1)
			.filter(item => item.competitor && item.competitor.Name)
			.map(item => ({
				name: item.competitor.Name,
				score: `${item.roundsMissed}/${item.totalRounds} rounds missed (${item.missedPercentage.toFixed(1)}%)`
			}));

	return {
		competitor: winner.competitor,
		roundsMissed: winner.roundsMissed,
		roundsParticipated: winner.roundsParticipated,
		totalRounds: winner.totalRounds,
		missedPercentage: winner.missedPercentage?.toFixed(1),
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

// Calculate the competitor who gives the most single-point votes (Single-Vote Giver)
export const calculateSingleVoteGiver = (votes, competitors) => {
	// Count single votes and total individual votes by voter
	const singleVotesByVoter = {};
	const totalIndividualVotesByVoter = {};

	votes.forEach(vote => {
		const voterId = vote['Voter ID'];
		const points = parseInt(vote['Points Assigned'] || 0);

		// Initialize counters
		if (!singleVotesByVoter[voterId]) singleVotesByVoter[voterId] = 0;
		if (!totalIndividualVotesByVoter[voterId]) totalIndividualVotesByVoter[voterId] = 0;

		// Count total individual votes (each point counts as one vote)
		totalIndividualVotesByVoter[voterId] += points;

		// Count single votes (exactly 1 point given to a submission)
		if (points === 1) {
			singleVotesByVoter[voterId]++;
		}
	});

	// Calculate single vote percentages for competitors with enough votes
	const competitorsWithSingleVoteStats = [];

	Object.entries(singleVotesByVoter).forEach(([voterId, singleCount]) => {
		const totalIndividualVotes = totalIndividualVotesByVoter[voterId];

		// Only consider voters with at least 30 individual votes
		if (totalIndividualVotes >= 30) {
			const singlePercentage = (singleCount / totalIndividualVotes) * 100;

			const competitor = competitors.find(comp => comp.ID === voterId);

			if (competitor) {
				competitorsWithSingleVoteStats.push({
					competitor,
					singleCount,
					totalIndividualVotes,
					singlePercentage
				});
			}
		}
	});

	// Sort by single vote percentage (descending)
	competitorsWithSingleVoteStats.sort((a, b) => b.singlePercentage - a.singlePercentage);

	// Check for ties (multiple competitors with the same single vote percentage)
	const highestSinglePercentage = competitorsWithSingleVoteStats[0]?.singlePercentage;
	const tiedWinners = competitorsWithSingleVoteStats.filter(item =>
		Math.abs(item.singlePercentage - highestSinglePercentage) < 0.1
	);
	const isTied = tiedWinners.length > 1;

	// The winner is the first item in the sorted array
	const winner = competitorsWithSingleVoteStats[0];

	// Get tied winners' names if there's a tie
	const tiedWinnersNames = isTied ? tiedWinners.map(item => item.competitor.Name) : null;

	// Rest of the field (excluding tied winners if there's a tie)
	const restOfField = isTied
		? competitorsWithSingleVoteStats.filter(item =>
			Math.abs(item.singlePercentage - highestSinglePercentage) >= 0.1
		).map(item => ({
			name: item.competitor.Name,
			score: `${item.singleCount} single votes (${item.singlePercentage.toFixed(1)}% of ${item.totalIndividualVotes} total votes)`
		}))
		: competitorsWithSingleVoteStats.slice(1).map(item => ({
			name: item.competitor.Name,
			score: `${item.singleCount} single votes (${item.singlePercentage.toFixed(1)}% of ${item.totalIndividualVotes} total votes)`
		}));

	return {
		competitor: winner?.competitor,
		singleCount: winner?.singleCount,
		totalVotes: winner?.totalIndividualVotes,
		singlePercentage: winner?.singlePercentage?.toFixed(1),
		restOfField,
		isTied,
		tiedWinners: tiedWinnersNames
	};
};

const calculateSubmissionTimingImpact = (submissions, votes, rounds, competitors) => {
	const buildEmptyResult = () => ({
		enrichedSubmissions: [],
		summary: {
			sampleSize: 0,
			spearmanCoefficient: null,
			pValue: null,
			isSignificant: false,
			direction: 'neutral',
			averageVotes: null,
			earlyVsLate: {
				early: { count: 0, averageVotes: null, averagePerformance: null },
				late: { count: 0, averageVotes: null, averagePerformance: null },
				deltaVotes: null,
				deltaPerformance: null
			},
			bucketAverages: [],
			perRound: []
		},
		perCompetitor: {},
		topEarly: null,
		topLate: null
	});

	if (
		!Array.isArray(submissions) ||
		submissions.length === 0 ||
		!Array.isArray(votes) ||
		votes.length === 0
	) {
		return buildEmptyResult();
	}

	const votesBySubmission = {};
	votes.forEach(vote => {
		const uri = vote?.['Spotify URI'];
		if (!uri) return;
		const points = parseInt(vote['Points Assigned'] || 0, 10);
		if (!Number.isFinite(points)) return;
		votesBySubmission[uri] = (votesBySubmission[uri] || 0) + points;
	});

	const competitorLookup = {};
	(competitors || []).forEach(competitor => {
		if (competitor?.ID) {
			competitorLookup[competitor.ID] = competitor;
		}
	});

	const roundLookup = {};
	(rounds || []).forEach((round, index) => {
		if (round?.ID) {
			roundLookup[round.ID] = {
				name: round?.Name || `Round ${index + 1}`,
				order: index
			};
		}
	});

	const submissionsByRound = {};
	submissions.forEach(submission => {
		const roundId = submission?.['Round ID'];
		const createdAt = safeParseDate(submission?.Created);
		const uri = submission?.['Spotify URI'];
		if (!roundId || !uri || !createdAt || !roundLookup[roundId]) return;

		if (!submissionsByRound[roundId]) submissionsByRound[roundId] = [];

		submissionsByRound[roundId].push({
			uri,
			title: submission?.Title || 'Unknown Track',
			createdAt,
			createdAtMs: createdAt.getTime(),
			votes: votesBySubmission[uri] || 0,
			submitterId: submission?.['Submitter ID'],
			submitterName: competitorLookup[submission?.['Submitter ID']]?.Name || 'Unknown',
			roundId,
			roundName: roundLookup[roundId].name,
			roundOrder: roundLookup[roundId].order + 1
		});
	});

	const enrichedSubmissions = [];
	const perRoundSummaries = [];

	Object.entries(submissionsByRound).forEach(([roundId, roundSubmissions]) => {
		if (!Array.isArray(roundSubmissions) || roundSubmissions.length === 0) return;

		roundSubmissions.sort((a, b) => {
			if (a.createdAtMs === b.createdAtMs) {
				return a.uri.localeCompare(b.uri);
			}
			return a.createdAtMs - b.createdAtMs;
		});

		const voteValues = roundSubmissions.map(item => item.votes);
		const minVotes = Math.min(...voteValues);
		const maxVotes = Math.max(...voteValues);
		const voteRange = maxVotes - minVotes;
		const meanVotes = mean(voteValues) ?? 0;
		const stdVotes = standardDeviation(voteValues);
		const performanceRanks = rankArray(voteValues, { descending: true });

		const firstCreated = roundSubmissions[0].createdAtMs;
		const lastCreated = roundSubmissions[roundSubmissions.length - 1].createdAtMs;
		const spanMs = Math.max(lastCreated - firstCreated, 0);
		const spanHours = spanMs / (1000 * 60 * 60);

		roundSubmissions.forEach((submission, index) => {
			const submissionCount = roundSubmissions.length;
			const order = index + 1;
			const orderPercentile = submissionCount > 1 ? index / (submissionCount - 1) : 0.5;
			const earliness = 1 - orderPercentile;
			const timeFromFirstHours = (submission.createdAtMs - firstCreated) / (1000 * 60 * 60);
			const timePercent = spanMs > 0 ? (submission.createdAtMs - firstCreated) / spanMs : 0.5;
			const relativeVotes = voteRange > 0 ? (submission.votes - minVotes) / voteRange : 0.5;
			const zScore = stdVotes > 0 ? (submission.votes - meanVotes) / stdVotes : 0;
			const performanceRank = submissionCount > 1
				? 1 - ((performanceRanks[index] - 1) / (submissionCount - 1))
				: 0.5;

			enrichedSubmissions.push({
				...submission,
				submissionOrder: order,
				roundSubmissionCount: submissionCount,
				orderPercentile,
				earliness,
				timeFromFirstHours,
				timePercent,
				relativeVotes,
				zScore,
				performanceRank
			});
		});

		perRoundSummaries.push({
			roundId,
			roundName: roundLookup[roundId]?.name || 'Unknown Round',
			submissionCount: roundSubmissions.length,
			spanHours,
			minVotes,
			maxVotes,
			meanVotes,
			stdVotes
		});
	});

	const sampleSize = enrichedSubmissions.length;
	if (!sampleSize) {
		const result = buildEmptyResult();
		result.enrichedSubmissions = enrichedSubmissions;
		result.summary.perRound = perRoundSummaries;
		return result;
	}

	const earlinessValues = enrichedSubmissions.map(item => item.earliness);
	const performanceValues = enrichedSubmissions.map(item => item.performanceRank);

	const spearman = spearmanCorrelation(earlinessValues, performanceValues);
	const pValue = spearman !== null ? correlationPValue(spearman, sampleSize) : null;
	const isSignificant = pValue !== null && pValue < 0.05;
	const direction = spearman === null || Math.abs(spearman) < 0.05
		? 'neutral'
		: spearman > 0 ? 'early_advantage' : 'late_advantage';

	const meanFromGroup = (group, key) => {
		if (!group.length) return null;
		return mean(group.map(item => item[key]));
	};

	const earlyGroup = enrichedSubmissions.filter(item => item.orderPercentile <= 0.5);
	const lateGroup = enrichedSubmissions.filter(item => item.orderPercentile > 0.5);

	const earlyAvgVotes = meanFromGroup(earlyGroup, 'votes');
	const lateAvgVotes = meanFromGroup(lateGroup, 'votes');
	const earlyAvgPerformance = meanFromGroup(earlyGroup, 'performanceRank');
	const lateAvgPerformance = meanFromGroup(lateGroup, 'performanceRank');

	const bucketCount = 8;
	const bucketStats = Array.from({ length: bucketCount }, (_, index) => ({
		index,
		lowerBound: index / bucketCount,
		upperBound: (index + 1) / bucketCount,
		center: (index + 0.5) / bucketCount,
		count: 0,
		voteSum: 0,
		relativeVoteSum: 0,
		performanceSum: 0
	}));

	enrichedSubmissions.forEach(entry => {
		let bucketIndex = Math.floor(entry.orderPercentile * bucketCount);
		if (bucketIndex >= bucketCount) bucketIndex = bucketCount - 1;
		const bucket = bucketStats[bucketIndex];
		bucket.count += 1;
		bucket.voteSum += entry.votes;
		bucket.relativeVoteSum += entry.relativeVotes;
		bucket.performanceSum += entry.performanceRank;
	});

	const bucketAverages = bucketStats.map(bucket => ({
		bucketIndex: bucket.index,
		label: `${Math.round(bucket.lowerBound * 100)}-${Math.round(bucket.upperBound * 100)}%`,
		center: bucket.center,
		averageVotes: bucket.count ? bucket.voteSum / bucket.count : null,
		averageRelativeVotes: bucket.count ? bucket.relativeVoteSum / bucket.count : null,
		averagePerformance: bucket.count ? bucket.performanceSum / bucket.count : null,
		count: bucket.count
	}));

	const perCompetitor = {};
	enrichedSubmissions.forEach(entry => {
		const key = entry.submitterId || 'unknown';
		if (!perCompetitor[key]) {
			perCompetitor[key] = {
				competitor: competitorLookup[key] || { ID: key, Name: entry.submitterName || 'Unknown' },
				entries: []
			};
		}
		perCompetitor[key].entries.push(entry);
	});

	let bestEarly = null;
	let bestLate = null;

	Object.values(perCompetitor).forEach(metric => {
		metric.entries.sort((a, b) => a.createdAtMs - b.createdAtMs);
		const entryCount = metric.entries.length;
		metric.sampleSize = entryCount;

		const earlinessList = metric.entries.map(entry => entry.earliness);
		const performanceList = metric.entries.map(entry => entry.performanceRank);
		const rawVotesList = metric.entries.map(entry => entry.votes);

		metric.correlation = entryCount >= 3 ? spearmanCorrelation(earlinessList, performanceList) : null;
		metric.pValue = metric.correlation !== null ? correlationPValue(metric.correlation, entryCount) : null;
		metric.isSignificant = metric.pValue !== null && metric.pValue < 0.05;
		metric.averageOrderPercentile = mean(metric.entries.map(entry => entry.orderPercentile));
		metric.averageEarliness = mean(metric.entries.map(entry => entry.earliness));
		metric.averageVotes = mean(rawVotesList);
		metric.averagePerformance = mean(metric.entries.map(entry => entry.performanceRank));
		metric.averageRelativeVotes = mean(metric.entries.map(entry => entry.relativeVotes));

		const earlyEntries = metric.entries.filter(entry => entry.orderPercentile <= 0.5);
		const lateEntries = metric.entries.filter(entry => entry.orderPercentile > 0.5);

		metric.earlyCount = earlyEntries.length;
		metric.lateCount = lateEntries.length;
		metric.earlyAvgPerformance = meanFromGroup(earlyEntries, 'performanceRank');
		metric.lateAvgPerformance = meanFromGroup(lateEntries, 'performanceRank');
		metric.earlyAvgVotes = meanFromGroup(earlyEntries, 'votes');
		metric.lateAvgVotes = meanFromGroup(lateEntries, 'votes');

		metric.performanceDelta = (metric.earlyAvgPerformance !== null && metric.lateAvgPerformance !== null)
			? metric.earlyAvgPerformance - metric.lateAvgPerformance
			: null;

		metric.voteDelta = (metric.earlyAvgVotes !== null && metric.lateAvgVotes !== null)
			? metric.earlyAvgVotes - metric.lateAvgVotes
			: null;

		if (metric.performanceDelta !== null && metric.sampleSize >= 4 && metric.earlyCount >= 2 && metric.lateCount >= 2) {
			if (metric.performanceDelta > 0 && (!bestEarly || metric.performanceDelta > bestEarly.performanceDelta)) {
				bestEarly = metric;
			}
			if (metric.performanceDelta < 0 && (!bestLate || metric.performanceDelta < bestLate.performanceDelta)) {
				bestLate = metric;
			}
		}
	});

	const formatAward = (metric, leaning) => {
		if (!metric) return null;
		return {
			competitor: metric.competitor,
			voteDelta: metric.voteDelta,
			performanceDelta: metric.performanceDelta,
			earlyAvgVotes: metric.earlyAvgVotes,
			lateAvgVotes: metric.lateAvgVotes,
			earlyAvgPerformance: metric.earlyAvgPerformance,
			lateAvgPerformance: metric.lateAvgPerformance,
			sampleSize: metric.sampleSize,
			earlyCount: metric.earlyCount,
			lateCount: metric.lateCount,
			correlation: metric.correlation,
			pValue: metric.pValue,
			isSignificant: metric.isSignificant,
			leaning
		};
	};

	const averageVotes = mean(enrichedSubmissions.map(entry => entry.votes));

	return {
		enrichedSubmissions,
		summary: {
			sampleSize,
			spearmanCoefficient: spearman,
			pValue,
			isSignificant,
			direction,
			averageVotes,
			earlyVsLate: {
				early: {
					count: earlyGroup.length,
					averageVotes: earlyAvgVotes,
					averagePerformance: earlyAvgPerformance
				},
				late: {
					count: lateGroup.length,
					averageVotes: lateAvgVotes,
					averagePerformance: lateAvgPerformance
				},
				deltaVotes: (earlyAvgVotes !== null && lateAvgVotes !== null) ? earlyAvgVotes - lateAvgVotes : null,
				deltaPerformance: (earlyAvgPerformance !== null && lateAvgPerformance !== null)
					? earlyAvgPerformance - lateAvgPerformance
					: null
			},
			bucketAverages,
			perRound: perRoundSummaries
		},
		perCompetitor,
		topEarly: formatAward(bestEarly, 'early'),
		topLate: formatAward(bestLate, 'late')
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
	const singleVoteGiver = calculateSingleVoteGiver(votes, competitors);
	const maxVoteGiver = calculateMaxVoteGiver(votes, competitors, submissions);
	const comebackKid = calculateComebackKid(votes, submissions, competitors, rounds);
	const doesntVote = calculateDoesntVote(votes, competitors, rounds);
	const submissionTiming = calculateSubmissionTimingImpact(submissions, votes, rounds, competitors);

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
		singleVoteGiver,
		maxVoteGiver,
		comebackKid,
		doesntVote,
		submissionTiming
	};
};