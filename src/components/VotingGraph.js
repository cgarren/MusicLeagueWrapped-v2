import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Card, CardContent, Tooltip, useMediaQuery, useTheme } from '@mui/material';

// Enhanced graph visualization to show voting relationships
const VotingGraph = ({ competitors, votes, submissions }) => {
	const canvasRef = useRef(null);
	const containerRef = useRef(null);
	const [hoveredNode, setHoveredNode] = useState(null);
	const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

	// Calculate voting relationships
	useEffect(() => {
		if (!canvasRef.current || !competitors || !votes || !submissions || !containerRef.current) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d');

		// Set high-resolution canvas
		const dpr = window.devicePixelRatio || 1;
		const rect = containerRef.current.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		canvas.style.width = `${rect.width}px`;
		canvas.style.height = `${rect.height}px`;
		ctx.scale(dpr, dpr);

		const width = rect.width;
		const height = rect.height;

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Map of submissions to their submitters
		const submissionToSubmitter = {};
		submissions.forEach(submission => {
			submissionToSubmitter[submission['Spotify URI']] = submission['Submitter ID'];
		});

		// Build a matrix of votes: how many points A gave to B
		const voteMatrix = {};
		const maxPoints = {};

		votes.forEach(vote => {
			const voterId = vote['Voter ID'];
			const submissionUri = vote['Spotify URI'];
			const submitterId = submissionToSubmitter[submissionUri];
			const points = parseInt(vote['Points Assigned'] || 0);

			// Skip self-votes
			if (voterId === submitterId) return;

			// Initialize matrix entries if they don't exist
			if (!voteMatrix[voterId]) voteMatrix[voterId] = {};
			if (!voteMatrix[voterId][submitterId]) voteMatrix[voterId][submitterId] = 0;

			// Count votes
			voteMatrix[voterId][submitterId] += points;

			// Track maximum points for scaling
			if (!maxPoints[voterId]) maxPoints[voterId] = 0;
			maxPoints[voterId] = Math.max(maxPoints[voterId], voteMatrix[voterId][submitterId]);
		});

		// Position nodes in a circle
		const nodeRadius = isMobile ? 15 : 20;
		const centerX = width / 2;
		const centerY = height / 2;
		const circleRadius = Math.min(width, height) / 2.5 - nodeRadius;

		const nodePositions = {};

		// Create a set of active competitor IDs that appear in votes or submissions
		const activeCompetitorIds = new Set();

		// Add submitters to active competitors
		submissions.forEach(submission => {
			const submitterId = submission['Submitter ID'];
			activeCompetitorIds.add(submitterId);
		});

		// Add voters to active competitors
		votes.forEach(vote => {
			const voterId = vote['Voter ID'];
			activeCompetitorIds.add(voterId);
		});

		// Filter active competitors
		const activeCompetitors = competitors.filter(c => activeCompetitorIds.has(c.ID));

		// Only position active competitors
		activeCompetitors.forEach((competitor, index) => {
			const angle = (index / activeCompetitors.length) * Math.PI * 2;
			const x = centerX + circleRadius * Math.cos(angle);
			const y = centerY + circleRadius * Math.sin(angle);

			nodePositions[competitor.ID] = {
				x,
				y,
				competitor,
				radius: nodeRadius
			};
		});

		// Draw background grid (subtle)
		ctx.strokeStyle = 'rgba(200, 200, 200, 0.1)';
		ctx.lineWidth = 0.5;

		for (let i = 0; i < 360; i += 30) {
			const angle = (i / 180) * Math.PI;
			ctx.beginPath();
			ctx.moveTo(centerX, centerY);
			ctx.lineTo(
				centerX + Math.cos(angle) * (circleRadius + nodeRadius * 2),
				centerY + Math.sin(angle) * (circleRadius + nodeRadius * 2)
			);
			ctx.stroke();
		}

		// Draw connections (edges) - first pass for background lines
		Object.keys(voteMatrix).forEach(voterId => {
			Object.keys(voteMatrix[voterId] || {}).forEach(submitterId => {
				const points = voteMatrix[voterId][submitterId];
				const startPos = nodePositions[voterId];
				const endPos = nodePositions[submitterId];

				if (startPos && endPos && points > 0) {
					// Draw background line
					ctx.beginPath();
					ctx.moveTo(startPos.x, startPos.y);
					ctx.lineTo(endPos.x, endPos.y);
					ctx.strokeStyle = 'rgba(230, 230, 230, 0.3)';
					ctx.lineWidth = 0.5;
					ctx.stroke();
				}
			});
		});

		// Find global maximum points for better scaling
		let globalMaxPoints = 0;
		Object.values(maxPoints).forEach(max => {
			globalMaxPoints = Math.max(globalMaxPoints, max);
		});

		// Draw connections (edges) - second pass for actual relationships
		Object.keys(voteMatrix).forEach(voterId => {
			Object.keys(voteMatrix[voterId] || {}).forEach(submitterId => {
				const points = voteMatrix[voterId][submitterId];
				const startPos = nodePositions[voterId];
				const endPos = nodePositions[submitterId];

				if (startPos && endPos && points > 0) {
					// Calculate line properties based on points
					const normalizedPoints = points / globalMaxPoints;
					const lineWidth = Math.max(0.5, normalizedPoints * (isMobile ? 6 : 8));
					const alpha = Math.min(0.9, Math.max(0.1, normalizedPoints));

					// Draw relationship line
					ctx.beginPath();
					ctx.moveTo(startPos.x, startPos.y);

					// Draw a slight curve for visibility when lines overlap
					const midX = (startPos.x + endPos.x) / 2;
					const midY = (startPos.y + endPos.y) / 2;
					const dx = endPos.x - startPos.x;
					const dy = endPos.y - startPos.y;
					const norm = Math.sqrt(dx * dx + dy * dy);
					const offset = 5 + normalizedPoints * 10;

					// Perpendicular offset for curve
					const offsetX = -dy / norm * offset;
					const offsetY = dx / norm * offset;

					// Draw curved line
					ctx.quadraticCurveTo(
						midX + offsetX,
						midY + offsetY,
						endPos.x,
						endPos.y
					);

					ctx.strokeStyle = `rgba(146, 28, 189, ${alpha})`;
					ctx.lineWidth = lineWidth;
					ctx.stroke();

					// Add arrowhead to show direction
					const arrowSize = nodeRadius * 0.5 + lineWidth;
					const angle = Math.atan2(endPos.y - midY - offsetY, endPos.x - midX - offsetX);

					ctx.beginPath();
					ctx.moveTo(endPos.x, endPos.y);
					ctx.lineTo(
						endPos.x - arrowSize * Math.cos(angle - Math.PI / 6),
						endPos.y - arrowSize * Math.sin(angle - Math.PI / 6)
					);
					ctx.lineTo(
						endPos.x - arrowSize * Math.cos(angle + Math.PI / 6),
						endPos.y - arrowSize * Math.sin(angle + Math.PI / 6)
					);
					ctx.closePath();
					ctx.fillStyle = `rgba(146, 28, 189, ${alpha})`;
					ctx.fill();
				}
			});
		});

		// Draw nodes
		Object.values(nodePositions).forEach(({ x, y, competitor, radius }) => {
			// Draw outer circle for better visibility
			ctx.beginPath();
			ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
			ctx.fillStyle = 'white';
			ctx.fill();

			// Draw node
			ctx.beginPath();
			ctx.arc(x, y, radius, 0, Math.PI * 2);
			ctx.fillStyle = '#191414';
			ctx.fill();

			// Draw label
			ctx.fillStyle = 'white';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = `bold ${isMobile ? '12px' : '14px'} Arial`;

			// Show more than just first initial if available
			let label = '';
			const name = competitor.Name || '';

			if (name.includes(' ')) {
				// For names with spaces, use first letters of first and last names
				const parts = name.split(' ');
				label = parts[0][0] + parts[parts.length - 1][0];
			} else if (name.length > 0) {
				// For single names, use first two letters
				label = name.substring(0, Math.min(2, name.length));
			} else {
				// For missing names, use ID if available or a default
				label = competitor.ID ? competitor.ID.substring(0, 2) : 'NA';
			}

			ctx.fillText(label, x, y);
		});

		// Add legend
		if (!isMobile) {
			drawLegend(ctx, width, height);
		}

		// Add click handler for nodes
		const handleCanvasClick = (event) => {
			const rect = canvas.getBoundingClientRect();
			const x = (event.clientX - rect.left) * dpr;
			const y = (event.clientY - rect.top) * dpr;

			// Check if a node was clicked
			let clickedNode = null;
			Object.values(nodePositions).forEach(node => {
				const dx = x - node.x * dpr;
				const dy = y - node.y * dpr;
				const distance = Math.sqrt(dx * dx + dy * dy);
				if (distance <= node.radius * dpr) {
					clickedNode = node;
				}
			});

			if (clickedNode) {
				setHoveredNode(clickedNode.competitor);
				setTooltipPos({
					x: clickedNode.x,
					y: clickedNode.y
				});
			} else {
				setHoveredNode(null);
			}
		};

		// Add mousemove handler for hover effects
		const handleCanvasMouseMove = (event) => {
			const rect = canvas.getBoundingClientRect();
			const x = (event.clientX - rect.left) * dpr;
			const y = (event.clientY - rect.top) * dpr;

			// Check if hovering over a node
			let isOverNode = false;
			Object.values(nodePositions).forEach(node => {
				const dx = x - node.x * dpr;
				const dy = y - node.y * dpr;
				const distance = Math.sqrt(dx * dx + dy * dy);
				if (distance <= node.radius * dpr) {
					isOverNode = true;
					setHoveredNode(node.competitor);
					setTooltipPos({
						x: node.x,
						y: node.y
					});
				}
			});

			if (!isOverNode && hoveredNode) {
				setHoveredNode(null);
			}
		};

		canvas.addEventListener('click', handleCanvasClick);
		canvas.addEventListener('mousemove', handleCanvasMouseMove);

		return () => {
			canvas.removeEventListener('click', handleCanvasClick);
			canvas.removeEventListener('mousemove', handleCanvasMouseMove);
		};
	}, [competitors, votes, submissions, hoveredNode, isMobile]);

	// Draw legend function
	const drawLegend = (ctx, width, height) => {
		const legendX = width - 200;
		const legendY = height - 100;
		const legendWidth = 190;
		const legendHeight = 80;

		// Draw legend background
		ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
		ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
		ctx.lineWidth = 1;
		ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

		// Title
		ctx.fillStyle = '#191414';
		ctx.font = 'bold 12px Arial';
		ctx.textAlign = 'left';
		ctx.fillText('Legend', legendX + 10, legendY + 15);

		// Line thickness explanation
		ctx.fillStyle = '#191414';
		ctx.font = '10px Arial';

		// Draw thickness samples
		const lineY1 = legendY + 35;
		const lineY2 = legendY + 55;
		const lineX1 = legendX + 20;
		const lineX2 = legendX + 80;

		// Thin line
		ctx.beginPath();
		ctx.moveTo(lineX1, lineY1);
		ctx.lineTo(lineX2, lineY1);
		ctx.strokeStyle = 'rgba(146, 28, 189, 0.3)';
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.fillText('Few votes exchanged', lineX2 + 5, lineY1 + 3);

		// Thick line
		ctx.beginPath();
		ctx.moveTo(lineX1, lineY2);
		ctx.lineTo(lineX2, lineY2);
		ctx.strokeStyle = 'rgba(146, 28, 189, 0.9)';
		ctx.lineWidth = 5;
		ctx.stroke();
		ctx.fillText('Many votes exchanged', lineX2 + 5, lineY2 + 3);

	};

	return (
		<Card sx={{
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
			width: '100%',
			maxWidth: { xs: '100%', md: '100%' }
		}}>
			<CardContent sx={{ flexGrow: 1 }}>
				<Typography variant="h5" component="h2" gutterBottom color="primary" fontWeight="bold">
					Voting Network
				</Typography>

				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					Visual representation of voting relationships between competitors. Thicker, darker lines indicate more votes exchanged
				</Typography>

				<Box sx={{
					width: '100%',
					height: { xs: '350px', sm: '400px', md: '500px' },
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					position: 'relative',
					border: '1px solid #eee',
					borderRadius: 1,
					backgroundColor: '#fdfdfd',
					boxSizing: 'border-box'
				}} ref={containerRef}>
					<canvas
						ref={canvasRef}
						style={{ width: '100%', height: '100%', display: 'block' }}
					/>

					{hoveredNode && (
						<Tooltip
							open={true}
							title={
								<Box sx={{ p: 1 }}>
									<Typography variant="subtitle2">{hoveredNode.Name}</Typography>
								</Box>
							}
							arrow
							placement="top"
							PopperProps={{
								disablePortal: true,
								modifiers: [
									{
										name: 'preventOverflow',
										enabled: true,
										options: {
											boundary: 'viewport',
										},
									},
								],
							}}
							componentsProps={{
								tooltip: {
									sx: {
										bgcolor: 'white',
										color: 'black',
										boxShadow: 2,
										'& .MuiTooltip-arrow': {
											color: 'white',
										},
									},
								},
							}}
						>
							<Box
								sx={{
									position: 'absolute',
									left: tooltipPos.x,
									top: tooltipPos.y,
									width: 1,
									height: 1,
									pointerEvents: 'none',
									transform: 'translate(-50%, -0%)',
								}}
							/>
						</Tooltip>
					)}
				</Box>
			</CardContent>
		</Card>
	);
};

export default VotingGraph; 