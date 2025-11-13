const mean = (values = []) => {
	const numericValues = values.filter(
		(value) => typeof value === 'number' && Number.isFinite(value)
	);

	if (!numericValues.length) {
		return null;
	}

	const total = numericValues.reduce((sum, value) => sum + value, 0);
	return total / numericValues.length;
};

const calculatePearsonCorrelation = (x = [], y = []) => {
	if (
		!Array.isArray(x) ||
		!Array.isArray(y) ||
		x.length !== y.length ||
		x.length < 2
	) {
		return { coefficient: 0, valid: false };
	}

	const meanX = mean(x);
	const meanY = mean(y);

	if (meanX === null || meanY === null) {
		return { coefficient: 0, valid: false };
	}

	let numerator = 0;
	let sumSqX = 0;
	let sumSqY = 0;

	for (let i = 0; i < x.length; i++) {
		const centeredX = x[i] - meanX;
		const centeredY = y[i] - meanY;
		numerator += centeredX * centeredY;
		sumSqX += centeredX * centeredX;
		sumSqY += centeredY * centeredY;
	}

	const denominator = Math.sqrt(sumSqX * sumSqY);

	if (!denominator) {
		return { coefficient: 0, valid: false };
	}

	return { coefficient: numerator / denominator, valid: true };
};

const shuffleArray = (array = []) => {
	const shuffled = array.slice();
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
};

const determinePermutationIterations = (sampleSize) => {
	if (sampleSize >= 250) return 1500;
	if (sampleSize >= 120) return 2000;
	if (sampleSize >= 60) return 2500;
	if (sampleSize >= 30) return 3000;
	return 3500;
};

const calculateCorrelationWithPermutation = (x = [], y = [], iterations) => {
	const base = calculatePearsonCorrelation(x, y);

	if (!base.valid) {
		return {
			coefficient: 0,
			pValue: 1,
			iterations: 0,
			sampleSize: x.length || 0
		};
	}

	const coefficient = base.coefficient;
	const effectiveIterations = iterations ?? determinePermutationIterations(x.length);

	let extremeCount = 0;
	for (let i = 0; i < effectiveIterations; i++) {
		const shuffled = shuffleArray(y);
		const permuted = calculatePearsonCorrelation(x, shuffled);
		if (Math.abs(permuted.coefficient) >= Math.abs(coefficient) - 1e-12) {
			extremeCount++;
		}
	}

	const pValue = (extremeCount + 1) / (effectiveIterations + 1);

	return {
		coefficient,
		pValue,
		iterations: effectiveIterations,
		sampleSize: x.length
	};
};

export const calculateSubmissionTimingImpact = (
	competitors = [],
	rounds = [],
	submissions = [],
	votes = []
) => {
	const competitorMap = {};
	competitors.forEach((competitor) => {
		if (competitor?.ID) {
			competitorMap[competitor.ID] = competitor;
		}
	});

	const roundMap = {};
	rounds.forEach((round, index) => {
		if (round?.ID) {
			roundMap[round.ID] = {
				...round,
				order: index + 1
			};
		}
	});

	const voteTotals = {};
	votes.forEach((vote) => {
		const uri = vote?.['Spotify URI'];
		if (!uri) return;
		const points = parseInt(vote['Points Assigned'] || 0, 10);
		if (!Number.isFinite(points)) return;
		voteTotals[uri] = (voteTotals[uri] || 0) + points;
	});

	const submissionsByRound = {};
	submissions.forEach((submission) => {
		const roundId = submission?.['Round ID'];
		const createdAt = submission?.Created;
		const uri = submission?.['Spotify URI'];

		if (!roundId || !roundMap[roundId] || !createdAt || !uri) {
			return;
		}

		const createdDate = new Date(createdAt);
		if (!Number.isFinite(createdDate.getTime())) {
			return;
		}

		if (!submissionsByRound[roundId]) {
			submissionsByRound[roundId] = [];
		}

		submissionsByRound[roundId].push({
			submission,
			createdDate
		});
	});

	const submissionRecords = [];

	Object.entries(submissionsByRound).forEach(([roundId, entries]) => {
		entries.sort((a, b) => a.createdDate - b.createdDate);
		const { length } = entries;

		if (!length) return;

		const firstTime = entries[0].createdDate.getTime();
		const lastTime = entries[length - 1].createdDate.getTime();
		const timeRange = Math.max(1, lastTime - firstTime);

		entries.forEach((entry, index) => {
			const { submission } = entry;
			const submitterId = submission?.['Submitter ID'];
			const order = index + 1;
			const orderFraction = length > 1 ? index / (length - 1) : 0.5;
			const relativeTime = (entry.createdDate.getTime() - firstTime) / timeRange;
			const votesForSubmission = voteTotals[submission['Spotify URI']] || 0;

			submissionRecords.push({
				roundId,
				roundName: roundMap[roundId]?.Name || 'Unknown Round',
				roundNumber: roundMap[roundId]?.order ?? null,
				submitterId,
				submitterName: competitorMap[submitterId]?.Name || 'Unknown Competitor',
				createdUtc: entry.createdDate.toISOString(),
				createdOriginal: submission.Created,
				order,
				orderTotal: length,
				orderFraction,
				relativeTime,
				votes: votesForSubmission,
				title: submission.Title,
				spotifyUri: submission['Spotify URI']
			});
		});
	});

	const sampleSize = submissionRecords.length;
	if (sampleSize < 3) {
		return {
			overall: {
				coefficient: 0,
				pValue: 1,
				iterations: 0,
				sampleSize: 0,
				isSignificant: false,
				earlyAvgVotes: null,
				lateAvgVotes: null,
				difference: null,
				direction: 'insufficient-data'
			},
			competitorStats: {},
			bestCompetitor: null,
			rankedCompetitors: [],
			submissionRecords
		};
	}

	const x = submissionRecords.map((record) => record.orderFraction);
	const y = submissionRecords.map((record) => record.votes);

	const overall = calculateCorrelationWithPermutation(x, y);
	const sortedRecords = submissionRecords
		.slice()
		.sort((a, b) => a.orderFraction - b.orderFraction);
	const quartileSize = Math.max(1, Math.floor(sampleSize / 4));

	const earlyAvgVotes = mean(sortedRecords.slice(0, quartileSize).map((r) => r.votes));
	const lateAvgVotes = mean(
		sortedRecords.slice(-quartileSize).map((record) => record.votes)
	);

	const direction =
		overall.coefficient < -0.05
			? 'earlier-better'
			: overall.coefficient > 0.05
				? 'later-better'
				: 'neutral';

	const competitorBuckets = {};
	submissionRecords.forEach((record) => {
		if (!record.submitterId) return;
		if (!competitorBuckets[record.submitterId]) {
			competitorBuckets[record.submitterId] = [];
		}
		competitorBuckets[record.submitterId].push(record);
	});

	const competitorStats = {};
	Object.entries(competitorBuckets).forEach(([competitorId, records]) => {
		if (!records || records.length < 3) return;
		const iterations = determinePermutationIterations(records.length);
		const pointsX = records.map((record) => record.orderFraction);
		const pointsY = records.map((record) => record.votes);
		const correlation = calculateCorrelationWithPermutation(pointsX, pointsY, iterations);

		const sortedByOrder = records
			.slice()
			.sort((a, b) => a.orderFraction - b.orderFraction);
		const half = Math.max(1, Math.floor(records.length / 2));

		const earlyAvg = mean(sortedByOrder.slice(0, half).map((record) => record.votes));
		const lateAvg = mean(sortedByOrder.slice(-half).map((record) => record.votes));

		competitorStats[competitorId] = {
			competitor: competitorMap[competitorId] || null,
			coefficient: correlation.coefficient,
			pValue: correlation.pValue,
			iterations: correlation.iterations,
			sampleSize: correlation.sampleSize,
			isSignificant: correlation.pValue <= 0.05,
			earlyAvgVotes: earlyAvg,
			lateAvgVotes: lateAvg,
			difference:
				lateAvg !== null && earlyAvg !== null ? lateAvg - earlyAvg : null,
			direction:
				correlation.coefficient < -0.05
					? 'earlier-better'
					: correlation.coefficient > 0.05
						? 'later-better'
						: 'neutral'
		};
	});

	const statsArray = Object.values(competitorStats).map((stat) => {
		let impactScore = 0;
		if (direction === 'earlier-better') {
			if (stat.earlyAvgVotes !== null && stat.lateAvgVotes !== null) {
				impactScore = stat.earlyAvgVotes - stat.lateAvgVotes;
			} else {
				impactScore = -(stat.difference ?? 0);
			}
		} else if (direction === 'later-better') {
			if (stat.earlyAvgVotes !== null && stat.lateAvgVotes !== null) {
				impactScore = stat.lateAvgVotes - stat.earlyAvgVotes;
			} else {
				impactScore = stat.difference ?? 0;
			}
		} else {
			impactScore = Math.abs(stat.coefficient);
		}

		return {
			...stat,
			impactScore
		};
	});

	const rankedCompetitors = statsArray
		.filter((stat) => stat.competitor)
		.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));

	return {
		overall: {
			...overall,
			isSignificant: overall.pValue <= 0.05,
			earlyAvgVotes,
			lateAvgVotes,
			difference:
				lateAvgVotes !== null && earlyAvgVotes !== null
					? lateAvgVotes - earlyAvgVotes
					: null,
			direction
		},
		competitorStats,
		bestCompetitor: rankedCompetitors[0] || null,
		rankedCompetitors,
		submissionRecords
	};
};

