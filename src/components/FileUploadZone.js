import React, { useCallback } from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const FileUploadZone = ({ onFileUpload, fileName, isUploaded, label, description }) => {
	const onDrop = useCallback((acceptedFiles) => {
		const file = acceptedFiles[0];
		if (file) {
			Papa.parse(file, {
				header: true,
				complete: (results) => {
					onFileUpload(results.data, file.name);
				},
				error: (error) => {
					console.error('Error parsing CSV:', error);
				}
			});
		}
	}, [onFileUpload]);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			'text/csv': ['.csv']
		},
		multiple: false
	});

	return (
		<Paper
			{...getRootProps()}
			sx={{
				p: 3,
				width: '248px',
				maxWidth: '248px',
				minWidth: '248px',
				height: 200,
				minHeight: 200,
				flexShrink: 0,
				flexGrow: 0,
				border: '2px dashed',
				borderColor: isUploaded ? 'success.main' : isDragActive ? 'primary.main' : 'grey.300',
				backgroundColor: isUploaded ? 'success.light' : isDragActive ? 'primary.light' : 'grey.50',
				cursor: 'pointer',
				textAlign: 'center',
				transition: 'all 0.3s ease',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				mx: 'auto',
				boxSizing: 'border-box',
				'&:hover': {
					borderColor: isUploaded ? 'success.main' : 'primary.main',
					backgroundColor: isUploaded ? 'success.light' : 'primary.light'
				}
			}}
		>
			<input {...getInputProps()} />
			<Box sx={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: 1,
				height: '100%',
				justifyContent: 'space-between',
				position: 'relative'
			}}>
				<Box sx={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 1,
					flex: '0 0 auto'
				}}>
					{isUploaded ? (
						<CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
					) : (
						<CloudUploadIcon color={isDragActive ? 'primary' : 'action'} sx={{ fontSize: 40 }} />
					)}
					<Typography variant="h6" color={isUploaded ? 'success.main' : 'textPrimary'}>
						{label}
					</Typography>
					<Typography variant="body2" color="textSecondary">
						{description}
					</Typography>
				</Box>

				<Box sx={{
					height: '48px',
					width: '100%',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					flex: '0 0 48px',
					overflow: 'hidden'
				}}>
					{isUploaded && fileName ? (
						<Typography variant="body2" color="success.main" sx={{
							fontWeight: 'bold',
							textAlign: 'center',
							wordBreak: 'break-word',
							px: 1,
							width: '100%',
							lineHeight: 1.2,
							display: '-webkit-box',
							WebkitLineClamp: 2,
							WebkitBoxOrient: 'vertical',
							overflow: 'hidden',
							textOverflow: 'ellipsis'
						}}>
							✓ {fileName}
						</Typography>
					) : (
						<Typography variant="body2" color="textSecondary" sx={{
							textAlign: 'center',
							px: 1,
							width: '100%',
							lineHeight: 1.2,
							display: '-webkit-box',
							WebkitLineClamp: 2,
							WebkitBoxOrient: 'vertical',
							overflow: 'hidden',
							textOverflow: 'ellipsis'
						}}>
							Drag & drop a CSV file here, or click to select
						</Typography>
					)}
				</Box>
			</Box>
		</Paper>
	);
};

export default FileUploadZone; 