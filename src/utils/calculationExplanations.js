// Calculation explanations for each superlative
export const CALCULATION_EXPLANATIONS = {
	mostPopular: `This award goes to the competitor who received the most total votes across all their song submissions throughout the season.

How it works:
• We sum up all the points/votes received for each competitor's submissions
• The competitor with the highest total wins
• Only considers votes from other participants (self-votes are excluded)`,

	consistentlyPopular: `This award recognizes the competitor with the highest average votes per submission, showing consistent quality across their picks.

How it works:
• Calculate total votes received ÷ number of submissions for each competitor
• Only competitors with 3+ submissions are considered
• The competitor with the highest average wins
• Though similar to most popular overall, this rewards consistency over volume and accounts for competitors who submit less songs for whatever reason`,

	mostAverage: `This award goes to the competitor whose average score is closest to the overall league average, representing the most "typical" performer.

How it works:
• Calculate each competitor's average votes per submission
• Calculate the overall league average across all competitors
• Find who has the smallest difference from the league average
• Only competitors with 3+ submissions are considered`,

	bestPerformance: `This award recognizes the highest single-round performance in the entire season.

How it works:
• Calculate total votes received for each song submission in each round
• Find the submission that received the most votes in any single round
• The submitter of that song wins`,

	comebackKid: `This award goes to the competitor who made the biggest comeback from their lowest-scoring submission to their best subsequent performance.

How it works:
• For each competitor, find their lowest-scoring submission
• Look for their highest-scoring submission that came after that low point
• Calculate the difference (comeback magnitude)
• Must be at least 5 points improvement to qualify
• The competitor with the biggest comeback wins`,

	trendSetter: `This award recognizes the competitor who submitted the most obscure songs based on Spotify popularity scores.

How it works:
• Each song has a Spotify popularity score (0-100, where lower = more obscure)
• Calculate average popularity across each competitor's submissions
• Only competitors with 3+ submissions with popularity data are considered
• The competitor with the lowest average popularity wins`,

	mainstream: `This award goes to the competitor who submitted the most popular songs based on Spotify popularity scores.

How it works:
• Each song has a Spotify popularity score (0-100, where higher = more popular)
• Calculate average popularity across each competitor's submissions
• Only competitors with 3+ submissions with popularity data are considered
• The competitor with the highest average popularity wins`,

	voteSpreader: `This award recognizes the competitor who distributes their votes most evenly across submissions, based on the lowest standard deviation.

How it works:
• Calculate the standard deviation of vote points assigned by each competitor
• Lower standard deviation = more even distribution of votes
• Only competitors who cast at least 30 individual vote points are considered
• The competitor with the lowest standard deviation wins`,

	singleVoteGiver: `This award goes to the competitor who gave the highest percentage of single-point votes.

How it works:
• Count how many times each competitor gave exactly 1 vote point to a submission
• Calculate this as a percentage of their total individual vote points
• Only competitors who cast at least 30 individual vote points are considered
• The competitor with the highest percentage wins`,

	maxVoteGiver: `This award recognizes the competitor who most frequently put all their votes on a single song in a round.

How it works:
• For each round, check if a competitor gave all their available points to just one song
• Calculate this as a percentage of rounds they participated in
• Only competitors who participated in at least 3 rounds are considered
• The competitor with the highest "all-in" percentage wins`,

	mostCompatible: `This award goes to the pair of competitors who consistently gave each other the highest votes.

How it works:
• Calculate average points each competitor gave to the other's submissions
• Compatibility score = geometric mean of both averages (e.g., √(3 × 4) = 3.46)
• Score ranges from 0-5+ where higher = more mutually supportive voting
• Only pairs where both have 3+ submissions are considered
• The pair with the highest compatibility score wins`,

	leastCompatible: `This award goes to the pair of competitors who consistently gave each other the lowest votes.

How it works:
• Calculate average points each competitor gave to the other's submissions
• Compatibility score = geometric mean of both averages (e.g., √(0.5 × 1) = 0.71)
• Score ranges from 0-5+ where lower = less mutually supportive voting
• Only pairs where both have 3+ submissions are considered
• The pair with the lowest compatibility score wins`,

	mostSimilar: `This award recognizes the pair of competitors who voted most similarly across all songs.

How it works:
• Compare voting patterns between all pairs of competitors
• Calculate average difference in points given to the same songs
• Similarity score = 5 minus average difference (higher = more similar)
• Similarity score ranges from 0 (completely different) to 5 (identical voting)
• Requires at least 10 common votes and 3 common rounds
• The pair with the highest similarity score wins`,

	leastSimilar: `This award goes to the pair of competitors who voted most differently across all songs.

How it works:
• Compare voting patterns between all pairs of competitors
• Calculate average difference in points given to the same songs
• Similarity score = 5 minus average difference (lower = less similar)
• Similarity score ranges from 0 (completely different) to 5 (identical voting)
• Requires at least 10 common votes and 3 common rounds
• The pair with the lowest similarity score wins`,

	earlyVoter: `This award goes to the competitor who most frequently voted in the first 25% of each round's voting period.

How it works:
• For each round, identify when each competitor first voted
• Sort by timestamp and mark the first 25% as "early voters"
• Count how many rounds each competitor was an early voter
• The competitor with the most early voting rounds wins`,

	lateVoter: `This award recognizes the competitor who most frequently voted in the last 25% of each round's voting period.

How it works:
• For each round, identify when each competitor last voted
• Sort by timestamp and mark the last 25% as "late voters"
• Count how many rounds each competitor was a late voter
• The competitor with the most late voting rounds wins`,

	longestComment: `This award goes to the competitor who left the single longest comment when voting.

How it works:
• Examine all comments left by competitors when voting
• Find the longest comment by character count
• The competitor who wrote that comment wins
• Shows the full comment text and character count`,

	mostComments: `This award recognizes the competitor who left the most comments total when voting.

How it works:
• Count the total number of comments each competitor left across all votes
• Only non-empty comments are counted
• The competitor with the highest comment count wins`,

	doesntVote: `This award goes to the competitor who missed the most rounds of voting.

How it works:
• Count how many rounds each competitor participated in vs. total rounds
• Calculate the number and percentage of rounds missed
• Only competitors who missed at least 1 round are considered
 • The competitor who missed the most rounds wins`,

	submissionTimingEarly: `This award highlights the competitor whose songs benefited most from being submitted early in each round.

How it works:
• For every round we record when each song was submitted and convert that into a percentile (0% = earliest, 100% = latest)
• Votes are normalized within each round so prompts with different totals can be compared fairly
• Each competitor needs at least two "early" (first half) and two "late" (second half) submissions to qualify
• We compare the average normalized performance of early versus late submissions
• The competitor with the largest positive difference (early minus late) wins`,

	submissionTimingLate: `This award recognizes the competitor who thrives despite submitting later in the window.

How it works:
• Same timing and normalization process as the early award
• Requires at least two songs submitted in the first half and two in the second half of their rounds
• We compare average performance of late submissions against early ones
• The competitor with the largest late-over-early advantage wins`
};
