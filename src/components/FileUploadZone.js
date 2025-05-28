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
				border: '2px dashed',
				borderColor: isUploaded ? 'success.main' : isDragActive ? 'primary.main' : 'grey.300',
				backgroundColor: isUploaded ? 'success.light' : isDragActive ? 'primary.light' : 'grey.50',
				cursor: 'pointer',
				textAlign: 'center',
				transition: 'all 0.3s ease',
				'&:hover': {
					borderColor: isUploaded ? 'success.main' : 'primary.main',
					backgroundColor: isUploaded ? 'success.light' : 'primary.light'
				}
			}}
		>
			<input {...getInputProps()} />
			<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
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
				{isUploaded && fileName && (
					<Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
						✓ {fileName}
					</Typography>
				)}
				{!isUploaded && (
					<Typography variant="body2" color="textSecondary">
						Drag & drop a CSV file here, or click to select
					</Typography>
				)}
			</Box>
		</Paper>
	);
};

export default FileUploadZone; 