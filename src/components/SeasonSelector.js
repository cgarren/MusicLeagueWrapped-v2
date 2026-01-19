import React, { useState } from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box, Typography, Button, CircularProgress } from '@mui/material';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { createPlaylist, extractTrackIdsFromUris } from '../utils/spotifyApi';

const SeasonSelector = ({ 
	seasons, 
	selectedSeason, 
	onSeasonChange, 
	submissions = [],
	leagueName = '',
	sx = {} 
}) => {
	const [isCreating, setIsCreating] = useState(false);
	const [playlistUrl, setPlaylistUrl] = useState(null);
	const [error, setError] = useState(null);

	const handleCreatePlaylist = async () => {
		if (!submissions || submissions.length === 0) {
			setError('No songs found for this season');
			return;
		}

		setIsCreating(true);
		setError(null);
		setPlaylistUrl(null);

		try {
			// Extract track IDs from submissions
			const spotifyUris = submissions
				.map(sub => sub['Spotify URI'])
				.filter(uri => uri);
			
			const trackIds = extractTrackIdsFromUris(spotifyUris);
			
			if (trackIds.length === 0) {
				throw new Error('No valid Spotify tracks found');
			}

			// Get current season label
			const currentSeasonObj = seasons.find(s => s.id === selectedSeason);
			const seasonLabel = currentSeasonObj?.label || selectedSeason;
			
			// Create playlist name and description
			const playlistName = `${leagueName} - ${seasonLabel}`;
			const playlistDescription = `All songs from ${leagueName} ${seasonLabel}. Created with Music League Wrapped.`;

			const result = await createPlaylist(playlistName, playlistDescription, trackIds);

			if (result.playlist?.url) {
				setPlaylistUrl(result.playlist.url);
				// Open the playlist in a new tab
				window.open(result.playlist.url, '_blank');
			}
		} catch (err) {
			console.error('Error creating playlist:', err);
			setError(err.message || 'Failed to create playlist');
		} finally {
			setIsCreating(false);
		}
	};

	const handleOpenPlaylist = () => {
		if (playlistUrl) {
			window.open(playlistUrl, '_blank');
		}
	};

	const showSeasonDropdown = seasons.length > 1;

	return (
		<Box sx={{
			display: 'flex',
			flexDirection: { xs: 'column', sm: 'row' },
			alignItems: 'center',
			gap: 2,
			mb: 3,
			justifyContent: 'center',
			...sx
		}}>
			{showSeasonDropdown && (
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
					<Typography variant="h6" component="span" sx={{
						fontSize: { xs: '1rem', sm: '1.25rem' },
						fontWeight: 'medium'
					}}>
						View Season:
					</Typography>
					<FormControl sx={{ minWidth: 120 }}>
						<InputLabel id="season-select-label">Season</InputLabel>
						<Select
							labelId="season-select-label"
							id="season-select"
							value={selectedSeason}
							label="Season"
							onChange={(e) => {
								onSeasonChange(e.target.value);
								// Reset playlist state when season changes
								setPlaylistUrl(null);
								setError(null);
							}}
							sx={{
								'& .MuiSelect-select': {
									py: 1
								}
							}}
						>
							{seasons.map((season) => (
								<MenuItem key={season.id} value={season.id}>
									{season.label}
								</MenuItem>
							))}
						</Select>
					</FormControl>
				</Box>
			)}

			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
				{playlistUrl ? (
					<Button
						variant="contained"
						color="success"
						startIcon={<CheckCircleIcon />}
						onClick={handleOpenPlaylist}
						sx={{ textTransform: 'none' }}
					>
						Open Playlist
					</Button>
				) : (
					<Button
						variant="outlined"
						color="primary"
						startIcon={isCreating ? <CircularProgress size={18} color="inherit" /> : <QueueMusicIcon />}
						onClick={handleCreatePlaylist}
						disabled={isCreating || !submissions || submissions.length === 0}
						sx={{ textTransform: 'none' }}
					>
						{isCreating ? 'Creating...' : 'Create Playlist'}
					</Button>
				)}
			</Box>

			{error && (
				<Typography variant="caption" color="error" sx={{ mt: { xs: 1, sm: 0 } }}>
					{error}
				</Typography>
			)}
		</Box>
	);
};

export default SeasonSelector; 