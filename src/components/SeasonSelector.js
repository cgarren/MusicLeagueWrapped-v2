import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box, Typography } from '@mui/material';

const SeasonSelector = ({ seasons, selectedSeason, onSeasonChange, sx = {} }) => {
	return (
		<Box sx={{
			display: 'flex',
			alignItems: 'center',
			gap: 2,
			mb: 3,
			justifyContent: 'center',
			...sx
		}}>
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
					onChange={(e) => onSeasonChange(e.target.value)}
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
	);
};

export default SeasonSelector; 