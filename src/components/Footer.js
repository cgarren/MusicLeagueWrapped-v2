import React from 'react';
import { Box, Typography } from '@mui/material';

const Footer = () => {
	return (
		<Box
			component="footer"
			sx={{
				py: 3,
				px: 2,
				mt: 'auto',
				backgroundColor: 'secondary.main',
				color: 'white',
				textAlign: 'center'
			}}
		>
			<Typography variant="body2">
				Cooper Garren &copy; {new Date().getFullYear()}
			</Typography>
		</Box>
	);
};

export default Footer; 