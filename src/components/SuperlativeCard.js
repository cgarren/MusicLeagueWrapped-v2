import React from 'react';
import { Card, CardContent, Typography, Box, Divider, List, ListItem, ListItemText } from '@mui/material';

const SuperlativeCard = ({ title, description, winnerName, detail, additionalCompetitors, isTied, tiedWinners, tiedDetails }) => {
	return (
		<Card sx={{
			height: '100%',
			width: '100%',
			maxWidth: '500px',
			display: 'flex',
			flexDirection: 'column',
			boxShadow: 3,
			transition: 'transform 0.3s, box-shadow 0.3s',
			overflow: 'hidden',
			'&:hover': {
				transform: 'translateY(-5px)',
				boxShadow: 6,
			},
			m: 0
		}}>
			<CardContent sx={{
				flexGrow: 1,
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				padding: 2
			}}>
				<Typography variant="h5" component="h2" gutterBottom color="primary" fontWeight="bold" sx={{ minHeight: '30px', display: 'flex', alignItems: 'flex-start' }}>
					{title}
				</Typography>

				<Typography variant="body2" color="text.secondary" sx={{ mb: 0, minHeight: '0px' }}>
					{description}
				</Typography>

				<Divider sx={{ my: 2 }} />

				<Typography variant="h6" component="div" sx={{ mt: 0, fontWeight: 'bold' }}>
					{isTied ? 'Tied Winners: ' : 'Winner: '}
					{isTied ? (tiedWinners ? tiedWinners.join(', ') : 'N/A') : (winnerName || 'N/A')}
				</Typography>

				{isTied && tiedDetails ? (
					<>
						{tiedDetails.map((tiedDetail, index) => (
							<Box key={index} sx={{ mt: 2, bgcolor: 'background.default', p: 2, borderRadius: 1, flexGrow: 0 }}>
								<Typography variant="subtitle2" fontWeight="medium">
									{tiedWinners[index]}:
								</Typography>
								<Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-line' }}>
									{tiedDetail}
								</Typography>
							</Box>
						))}
					</>
				) : (
					<Box sx={{ mt: 2, bgcolor: 'background.default', p: 2, borderRadius: 1, flexGrow: 1 }}>
						<Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-line' }}>
							{detail}
						</Typography>
					</Box>
				)}

				{additionalCompetitors && additionalCompetitors.length > 0 && (
					<Box sx={{ mt: 2 }}>
						<Typography variant="subtitle2" sx={{ fontWeight: 'medium', mb: 1 }}>
							Everyone else:
						</Typography>
						<List dense sx={{
							bgcolor: 'background.paper',
							borderRadius: 1,
							maxHeight: '150px',
							overflow: 'auto'
						}}>
							{additionalCompetitors.map((competitor, index) => (
								<ListItem key={index} sx={{ py: 0.5 }}>
									<ListItemText
										primary={`${competitor.name}: ${competitor.score}`}
										primaryTypographyProps={{
											variant: 'body2',
											color: 'text.secondary'
										}}
									/>
								</ListItem>
							))}
						</List>
					</Box>
				)}
			</CardContent>
		</Card>
	);
};

export default SuperlativeCard; 