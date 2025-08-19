# Music League Wrapped

A comprehensive React dashboard that displays insights, analytics, and "superlatives" from Music League data. This project analyzes voting patterns, submissions, and performances of competitors in a Music League and presents them in an engaging, interactive dashboard format with detailed visualizations and explanations.

## Live Site

https://www.musicleaguewrapped.com

## Features

### Superlatives & Awards

The dashboard calculates and displays comprehensive "superlatives" with detailed explanations:

- **Most Popular Overall**: Competitor who received the most total points across all submissions
- **Consistently Popular**: Competitor who received the highest average points per submission
- **Most Average**: Competitor whose average score is closest to the overall average
- **Best Performance**: Highest-scoring submission in a single round
- **Comeback Kid**: Competitor with the biggest improvement between their worst and best rounds
- **Trend Setter**: Competitor who submitted the most obscure songs (based on Spotify popularity)
- **Mainstream**: Competitor who submitted the most popular songs (based on Spotify popularity)
- **Vote Spreader**: Competitor who distributed votes most evenly across submissions
- **Single-Vote Giver**: Competitor who most frequently gave exactly 1 vote to submissions
- **Max-Vote Giver**: Competitor who most frequently gave the maximum votes (5 points) to submissions
- **Most Compatible Pair**: Two competitors who consistently gave each other high votes
- **Least Compatible Pair**: Two competitors who consistently gave each other low votes
- **Most Similar Taste**: Two competitors who voted most similarly across songs
- **Most Different Taste**: Two competitors who voted most differently across songs
- **Early Bird Voter**: Competitor who most frequently submitted votes early in voting periods
- **Last Minute Voter**: Competitor who most frequently submitted votes late in voting periods
- **Longest Comment**: Competitor who left the longest comment
- **Most Comments Given**: Competitor who left the most comments when voting
- **Doesn't Often Vote**: Competitor who participated in the fewest voting rounds

### Interactive Visualizations

#### Performance vs. Popularity Scatter Plot
- Visual comparison of song performance (votes received) vs. Spotify popularity
- Color-coded by competitor with interactive tooltips
- Shows relationship between mainstream appeal and league success

#### Performance Over Time Line Chart
- Track each competitor's vote totals across all rounds
- Straight-line connections between data points for precise visualization
- Click-to-explore detailed round results with song information
- Color-coded competitor legend
- Shows participation gaps and performance trends

#### Enhanced Voting Network Graph
- Interactive network visualization of voting relationships
- **Color-coded directional arrows** showing who voted for whom
- **Arrow focusing system**: Click competitors to highlight only their voting patterns
- Enhanced tooltips showing voting statistics (most votes given to)
- Professional legends explaining arrow meanings and interactions
- Clear visual distinction between vote strength (line thickness) and vote origin (color)

## Getting Started

### Prerequisites

- Node.js (version 14.x or later)
- npm (version 6.x or later)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/cgarren/MusicLeagueWrapped-v2.git
   cd MusicLeagueWrapped-v2
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
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

- **React** - Frontend framework with hooks for state management
- **Next.js** - React framework with file-based routing
- **Material UI (MUI)** - Component library for consistent design
- **Recharts** - Data visualization library for interactive charts
- **Canvas API** - Custom network graph visualization
- **papaparse** - CSV parsing for data ingestion

## Acknowledgments

- Thanks to the Music League team for the original platform
- Inspired by Spotify Wrapped 
