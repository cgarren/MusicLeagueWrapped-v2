import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Card, CardContent, Tooltip, useMediaQuery, useTheme } from '@mui/material';

// Enhanced graph visualization to show voting relationships
const VotingGraph = ({ competitors, votes, submissions }) => {
	const canvasRef = useRef(null);
	const containerRef = useRef(null);
	const [hoveredNode, setHoveredNode] = useState(null);
	const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
	const [focusedCompetitorId, setFocusedCompetitorId] = useState(null);
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

		// Define consistent color scheme matching other graphs
		const colors = [
			'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'
		];

		// Create mapping from competitor ID to color
		const competitorColors = {};
		activeCompetitors.forEach((competitor, index) => {
			const colorIndex = index % colors.length;
			competitorColors[competitor.ID] = colors[colorIndex];
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
					let alpha = Math.min(0.9, Math.max(0.3, normalizedPoints));

					// Get the color for this voter (arrow originator)
					const voterColor = competitorColors[voterId] || '#800080';

					// Convert hex color to RGB for alpha blending
					const hexToRgb = (hex) => {
						const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
						return result ? {
							r: parseInt(result[1], 16),
							g: parseInt(result[2], 16),
							b: parseInt(result[3], 16)
						} : { r: 128, g: 0, b: 128 };
					};

					const rgb = hexToRgb(voterColor);

					// Apply focus effect: dim other competitors' arrows when one is focused
					let isFocused = true;
					if (focusedCompetitorId !== null) {
						isFocused = voterId === focusedCompetitorId;
						if (!isFocused) {
							// Dim non-focused arrows significantly
							alpha *= 0.15;
						} else {
							// Slightly enhance focused arrows
							alpha = Math.min(1.0, alpha * 1.2);
						}
					}

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

					ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
					ctx.lineWidth = lineWidth;
					ctx.stroke();

					// Add enhanced arrowhead to show direction
					const baseArrowSize = isMobile ? 8 : 12;
					const arrowSize = baseArrowSize + (normalizedPoints * (isMobile ? 6 : 10));
					const angle = Math.atan2(endPos.y - midY - offsetY, endPos.x - midX - offsetX);

					// Position arrow slightly away from the node edge to avoid overlap
					const arrowDistance = nodeRadius + 3;
					const arrowX = endPos.x - arrowDistance * Math.cos(angle);
					const arrowY = endPos.y - arrowDistance * Math.sin(angle);

					// Draw a more prominent arrowhead
					ctx.beginPath();
					ctx.moveTo(arrowX, arrowY);
					ctx.lineTo(
						arrowX - arrowSize * Math.cos(angle - Math.PI / 5),
						arrowY - arrowSize * Math.sin(angle - Math.PI / 5)
					);
					ctx.lineTo(
						arrowX - arrowSize * 0.6 * Math.cos(angle),
						arrowY - arrowSize * 0.6 * Math.sin(angle)
					);
					ctx.lineTo(
						arrowX - arrowSize * Math.cos(angle + Math.PI / 5),
						arrowY - arrowSize * Math.sin(angle + Math.PI / 5)
					);
					ctx.closePath();

					// Make arrows more visible with higher contrast, using voter's color
					const arrowAlpha = Math.min(1.0, alpha + 0.2);
					ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${arrowAlpha})`;
					ctx.fill();

					// Add a subtle outline to make arrows even more visible
					const darkerRgb = {
						r: Math.max(0, rgb.r - 40),
						g: Math.max(0, rgb.g - 40),
						b: Math.max(0, rgb.b - 40)
					};
					ctx.strokeStyle = `rgba(${darkerRgb.r}, ${darkerRgb.g}, ${darkerRgb.b}, ${arrowAlpha})`;
					ctx.lineWidth = 0.5;
					ctx.stroke();
				}
			});
		});

		// Draw nodes
		Object.values(nodePositions).forEach(({ x, y, competitor, radius }) => {
			const isThisNodeFocused = focusedCompetitorId === competitor.ID;

			// Draw outer circle for better visibility (enhanced for focused node)
			ctx.beginPath();
			ctx.arc(x, y, radius + (isThisNodeFocused ? 4 : 2), 0, Math.PI * 2);
			ctx.fillStyle = isThisNodeFocused ? '#FFD700' : 'white'; // Gold highlight for focused node
			ctx.fill();

			// Add extra ring for focused node
			if (isThisNodeFocused) {
				ctx.beginPath();
				ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
				ctx.strokeStyle = '#FFD700';
				ctx.lineWidth = 2;
				ctx.stroke();
			}

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
				// Calculate voting stats for this competitor
				const votingStats = calculateVotingStats(clickedNode.competitor.ID);

				// Enhance the competitor object with voting stats
				const enhancedCompetitor = {
					...clickedNode.competitor,
					votingStats
				};

				setHoveredNode(enhancedCompetitor);
				setTooltipPos({
					x: clickedNode.x,
					y: clickedNode.y
				});

				// Set focus to this competitor (or clear if already focused)
				if (focusedCompetitorId === clickedNode.competitor.ID) {
					setFocusedCompetitorId(null); // Clear focus if clicking the same competitor
				} else {
					setFocusedCompetitorId(clickedNode.competitor.ID); // Focus on this competitor
				}
			} else {
				setHoveredNode(null);
				setFocusedCompetitorId(null); // Clear focus when clicking empty space
			}
		};

		// Calculate voting statistics for each competitor
		const calculateVotingStats = (competitorId) => {
			const votesGiven = voteMatrix[competitorId] || {};
			const competitorVotes = Object.entries(votesGiven);

			if (competitorVotes.length === 0) {
				return { mostVotedFor: null };
			}

			// Sort by points given (descending for most)
			const sortedByMost = [...competitorVotes].sort((a, b) => b[1] - a[1]);

			// Find competitor names
			const findCompetitorName = (id) => {
				const comp = competitors.find(c => c.ID === id);
				return comp ? comp.Name : 'Unknown';
			};

			const mostVotedFor = {
				name: findCompetitorName(sortedByMost[0][0]),
				points: sortedByMost[0][1]
			};

			return { mostVotedFor };
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

					// Calculate voting stats for this competitor
					const votingStats = calculateVotingStats(node.competitor.ID);

					// Enhance the competitor object with voting stats
					const enhancedCompetitor = {
						...node.competitor,
						votingStats
					};

					setHoveredNode(enhancedCompetitor);
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
	}, [competitors, votes, submissions, hoveredNode, isMobile, focusedCompetitorId]);

	// Draw legend function
	const drawLegend = (ctx, width, height) => {
		const legendX = width - 240;
		const legendY = height - 140;
		const legendWidth = 230;
		const legendHeight = 130;

		// Draw legend background
		ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
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

		// Draw thickness samples with colored arrows
		const lineY1 = legendY + 35;
		const lineY2 = legendY + 55;
		const lineY3 = legendY + 75;
		const lineY4 = legendY + 95;
		const lineX1 = legendX + 20;
		const lineX2 = legendX + 80;

		// Example colors for legend (first few from the array)
		const exampleColors = ['#FF0000', '#00FF00', '#0000FF'];

		// Thin line with small colored arrow
		ctx.beginPath();
		ctx.moveTo(lineX1, lineY1);
		ctx.lineTo(lineX2, lineY1);
		ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
		ctx.lineWidth = 1;
		ctx.stroke();

		// Small colored arrow
		const smallArrowSize = 6;
		const smallArrowX = lineX2 - 5;
		ctx.beginPath();
		ctx.moveTo(smallArrowX, lineY1);
		ctx.lineTo(smallArrowX - smallArrowSize, lineY1 - 3);
		ctx.lineTo(smallArrowX - smallArrowSize * 0.6, lineY1);
		ctx.lineTo(smallArrowX - smallArrowSize, lineY1 + 3);
		ctx.closePath();
		ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
		ctx.fill();

		ctx.fillStyle = '#191414';
		ctx.fillText('Few votes given', lineX2 + 10, lineY1 + 3);

		// Thick line with large colored arrow
		ctx.beginPath();
		ctx.moveTo(lineX1, lineY2);
		ctx.lineTo(lineX2, lineY2);
		ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
		ctx.lineWidth = 5;
		ctx.stroke();

		// Large colored arrow
		const largeArrowSize = 10;
		const largeArrowX = lineX2 - 5;
		ctx.beginPath();
		ctx.moveTo(largeArrowX, lineY2);
		ctx.lineTo(largeArrowX - largeArrowSize, lineY2 - 4);
		ctx.lineTo(largeArrowX - largeArrowSize * 0.6, lineY2);
		ctx.lineTo(largeArrowX - largeArrowSize, lineY2 + 4);
		ctx.closePath();
		ctx.fillStyle = 'rgba(0, 255, 0, 1.0)';
		ctx.fill();

		ctx.fillStyle = '#191414';
		ctx.fillText('Many votes given', lineX2 + 10, lineY2 + 3);

		// Directional explanation
		ctx.fillStyle = '#191414';
		ctx.font = 'bold 9px Arial';
		ctx.fillText('→ Arrow color = voter, direction = recipient', legendX + 10, lineY3 + 3);

		// Additional explanation
		ctx.font = '9px Arial';
		ctx.fillText('Click competitor to focus their arrows only', legendX + 10, lineY4 + 3);

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
					Visual representation of voting relationships between competitors. Thicker, darker lines indicate more votes exchanged, with arrows showing the direction of votes (who voted for whom). Each competitor has a unique arrow color. Click any competitor to focus on their voting patterns (click again or click empty space to clear focus). Hover over competitors to see detailed voting statistics.
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
								<Box sx={{ p: 1, minWidth: 200 }}>
									<Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
										{hoveredNode.Name}
									</Typography>

									{hoveredNode.votingStats?.mostVotedFor && (
										<Box sx={{ mb: 0 }}>
											<Typography variant="caption" sx={{ fontWeight: 'bold', color: 'success.main' }}>
												💚 Most votes given to:
											</Typography>
											<Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
												{hoveredNode.votingStats.mostVotedFor.name} ({hoveredNode.votingStats.mostVotedFor.points} votes)
											</Typography>
										</Box>
									)}

									{!hoveredNode.votingStats?.mostVotedFor && (
										<Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
											No voting data available
										</Typography>
									)}
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
										border: '1px solid #ddd',
										maxWidth: 300,
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

				{/* Competitor Color Legend */}
				<Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
					<Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
						Competitor Arrow Colors:
					</Typography>
					<Box sx={{
						display: 'flex',
						flexWrap: 'wrap',
						gap: 1.5,
						justifyContent: 'center'
					}}>
						{(() => {
							const colors = [
								'#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#FFA500', '#FFC0CB', '#A52A2A', '#808080', '#000000', '#DC143C', '#FFD700', '#4B0082', '#FF6347', '#32CD32', '#87CEEB', '#DDA0DD', '#F0E68C'
							];

							// Filter to only show competitors that appear in the graph
							const activeCompetitorIds = new Set();
							submissions.forEach(submission => {
								activeCompetitorIds.add(submission['Submitter ID']);
							});
							votes.forEach(vote => {
								activeCompetitorIds.add(vote['Voter ID']);
							});
							const activeCompetitors = competitors.filter(c => activeCompetitorIds.has(c.ID));

							return activeCompetitors?.map((competitor, index) => {
								if (!competitor || !competitor.Name) return null;
								const colorIndex = index % colors.length;

								return (
									<Box
										key={competitor.ID || index}
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 0.5,
											minWidth: 'fit-content'
										}}
									>
										{/* Arrow indicator */}
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												flexShrink: 0
											}}
										>
											<Box
												sx={{
													width: 16,
													height: 3,
													backgroundColor: colors[colorIndex],
													borderRadius: 1
												}}
											/>
											<Box
												sx={{
													width: 0,
													height: 0,
													borderLeft: '6px solid ' + colors[colorIndex],
													borderTop: '4px solid transparent',
													borderBottom: '4px solid transparent',
													ml: -0.5
												}}
											/>
										</Box>
										<Typography
											variant="caption"
											sx={{
												fontSize: { xs: '0.7rem', sm: '0.75rem' },
												whiteSpace: 'nowrap'
											}}
										>
											{competitor.Name}
										</Typography>
									</Box>
								);
							}).filter(Boolean);
						})()}
					</Box>
				</Box>
			</CardContent>
		</Card>
	);
};

export default VotingGraph; 