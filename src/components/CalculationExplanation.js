import React, { useState } from 'react';
import { Box, Collapse, Typography, IconButton } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { CALCULATION_EXPLANATIONS } from '../utils/calculationExplanations';

const CalculationExplanation = ({ calculationKey }) => {
	const [expanded, setExpanded] = useState(false);

	const handleToggle = () => {
		setExpanded(!expanded);
	};

	const explanation = CALCULATION_EXPLANATIONS[calculationKey];

	// If no explanation is found for this key, don't render the component
	if (!explanation) {
		return null;
	}

	return (
		<Box sx={{ mt: 2 }}>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					cursor: 'pointer',
					'&:hover': {
						bgcolor: 'action.hover',
					},
					borderRadius: 1,
					p: 1,
					transition: 'background-color 0.2s'
				}}
				onClick={handleToggle}
			>
				<Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 'medium', color: 'primary.main' }}>
					How is this calculated?
				</Typography>
				<IconButton size="small" sx={{ p: 0 }}>
					{expanded ? <ExpandLess /> : <ExpandMore />}
				</IconButton>
			</Box>
			<Collapse in={expanded}>
				<Box sx={{
					mt: 1,
					p: 2,
					bgcolor: 'grey.50',
					borderRadius: 1,
					border: '1px solid',
					borderColor: 'grey.200'
				}}>
					<Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.5 }}>
						{explanation}
					</Typography>
				</Box>
			</Collapse>
		</Box>
	);
};

export default CalculationExplanation;
