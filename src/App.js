import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import Footer from './components/Footer';

const theme = createTheme({
	palette: {
		primary: {
			main: '#921cbd', // Purple (was Spotify green)
		},
		secondary: {
			main: '#191414', // Spotify black
		},
		background: {
			default: '#f5f5f5',
		},
	},
	typography: {
		fontFamily: '"Circular", "Helvetica Neue", "Arial", sans-serif',
		h3: {
			fontWeight: 700,
		},
		h5: {
			fontWeight: 600,
		},
	},
});

function App() {
	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Box sx={{
				display: 'flex',
				flexDirection: 'column',
				minHeight: '100vh'
			}}>
				<Header />
				<Box component="main" sx={{ flexGrow: 1 }}>
					<Dashboard />
				</Box>
				<Footer />
			</Box>
		</ThemeProvider>
	);
}

export default App; 