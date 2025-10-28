const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Simple multer configuration
const upload = multer({ 
    dest: '/tmp/',
    limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/test-upload', upload.single('file'), (req, res) => {
    console.log('=== MULTER TEST ===');
    console.log('req.file:', req.file);
    console.log('req.body:', req.body);
    console.log('req.files:', req.files);
    
    if (!req.file) {
        return res.json({ error: 'No file received', success: false });
    }
    
    res.json({ 
        success: true, 
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
    });
});

app.listen(3001, () => {
    console.log('Test server running on port 3001');
    console.log('Test with: curl -X POST -F "file=@/Users/programmer/Projects/phoenix4ge/test-auto.jpg" http://localhost:3001/test-upload');
});