import React from 'react';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';

const Header = () => {
	return (
		<AppBar position="static" color="primary" elevation={0}>
			<Toolbar>
				<Box sx={{ display: 'flex', alignItems: 'center' }}>
					{/* Music note icon created with Unicode */}
					<Typography
						variant="h4"
						component="div"
						sx={{
							mr: 1,
							transform: 'translateY(-2px)',
							fontWeight: 'bold'
						}}
					>
						♫
					</Typography>
					<Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
						Music League Wrapped
					</Typography>
				</Box>
			</Toolbar>
		</AppBar>
	);
};

export default Header; 