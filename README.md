# Music League Wrapped

A React dashboard that displays insights and "superlatives" from Music League data. This project analyzes the voting patterns, submissions, and performances of competitors in a Music League and presents them in an engaging dashboard format.

## Features

The dashboard calculates and displays the following "superlatives":

- **Most Popular**: Competitor who received the most total points across all submissions
- **Least Popular**: Competitor who received the least average points per submission
- **Most Average**: Competitor whose average score is closest to the overall average
- **Best Performance**: Highest-scoring submission in a single round
- **Longest Comment**: Competitor who left the longest comment
- **Most Comments Given**: Competitor who left the most comments when voting
- **Most Compatible Pair**: Two competitors who gave each other the highest proportion of points
- **Least Compatible Pair**: Two competitors who gave each other the lowest proportion of points
- **Most Similar Voting**: Two competitors who voted most similarly on the same submissions
- **Most Dissimilar Voting**: Two competitors who voted most differently on the same submissions
- **Most Likely to Vote First**: Competitor who consistently votes early
- **Most Likely to Vote Last**: Competitor who consistently votes late

## Getting Started

### Prerequisites

- Node.js (version 14.x or later)
- npm (version 6.x or later)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/MusicLeagueWrapped-v2.git
   cd MusicLeagueWrapped-v2
   ```

2. Install dependencies:
   ```
   cd music-league-wrapped
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Data Format

The dashboard expects CSV files in the `/public/data/season1` directory with the following format:

- `competitors.csv`: Information about competitors
- `rounds.csv`: Information about the competition rounds
- `submissions.csv`: Songs submitted for each round
- `votes.csv`: Votes cast by competitors

The data directory supports multiple "seasons" of Music League data, organized in subfolders (e.g., `/public/data/season1`, `/public/data/season2`, etc.).

## Technologies Used

- React
- Material UI
- papaparse (for CSV parsing)
- recharts (for data visualization)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to the Music League team for the original platform
- Inspired by Spotify Wrapped 