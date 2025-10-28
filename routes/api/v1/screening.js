const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { requireApiAuth } = require('../../../middleware/apiAuth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Apply API auth to all routes
router.use(requireApiAuth);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const { interactionId } = req.params;
        // Get escort_client_id from interaction
        db.query(
            'SELECT escort_client_id FROM client_model_interactions WHERE id = ?',
            [interactionId]
        ).then(rows => {
            if (rows.length === 0) {
                return cb(new Error('Invalid interaction ID'));
            }
            
            const clientId = rows[0].escort_client_id;
            const uploadPath = path.join(__dirname, '../../../public/uploads/screening', clientId.toString());
            
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            
            cb(null, uploadPath);
        }).catch(err => {
            cb(err);
        });
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}_${timestamp}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// GET /api/v1/screening/:interactionId - Get screening info for client
router.get('/:interactionId', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId } = req.params;

        // Verify interaction belongs to this model
        const interactionCheck = await db.query(
            'SELECT escort_client_id FROM client_model_interactions WHERE id = ? AND model_id = ?',
            [interactionId, modelId]
        );

        if (interactionCheck.length === 0) {
            return res.fail(404, 'Client interaction not found' );
        }

        const escortClientId = interactionCheck[0].escort_client_id;

        // Get screening methods
        const methodsSql = `
            SELECT id, method_type, details, status, created_at, updated_at
            FROM client_screening_methods 
            WHERE client_model_interaction_id = ?
            ORDER BY created_at DESC`;
        
        const methods = await db.query(methodsSql, [interactionId]);

        // Get screening files
        const filesSql = `
            SELECT id, file_name, file_path, file_size, file_type, uploaded_at
            FROM client_screening_files 
            WHERE client_model_interaction_id = ?
            ORDER BY uploaded_at DESC`;
        
        const files = await db.query(filesSql, [interactionId]);

        res.json({
            success: true,
            data: {
                interaction_id: interactionId,
                escort_client_id: escortClientId,
                methods,
                files
            }
        });
    } catch (error) {
        console.error('Get screening error:', error);
        res.fail(500, 'Failed to retrieve screening information' );
    }
});

// POST /api/v1/screening/:interactionId/methods - Add screening method
router.post('/:interactionId/methods', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId } = req.params;
        const { method_type, details, status = 'pending' } = req.body;

        if (!method_type) {
            return res.fail(400, 'method_type is required' );
        }

        // Verify interaction belongs to this model
        const interactionCheck = await db.query(
            'SELECT escort_client_id FROM client_model_interactions WHERE id = ? AND model_id = ?',
            [interactionId, modelId]
        );

        if (interactionCheck.length === 0) {
            return res.fail(404, 'Client interaction not found' );
        }

        const escortClientId = interactionCheck[0].escort_client_id;

        // Insert screening method
        const result = await db.query(
            'INSERT INTO client_screening_methods (client_model_interaction_id, method_type, details, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [interactionId, method_type, details, status]
        );

        res.json({
            success: true,
            data: {
                id: result.insertId,
                client_model_interaction_id: interactionId,
                method_type,
                details,
                status
            }
        });
    } catch (error) {
        console.error('Add screening method error:', error);
        res.fail(500, 'Failed to add screening method' );
    }
});

// PUT /api/v1/screening/:interactionId/methods/:methodId - Update screening method
router.put('/:interactionId/methods/:methodId', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId, methodId } = req.params;
        const { method_type, details, status } = req.body;

        // Verify interaction belongs to this model
        const interactionCheck = await db.query(
            'SELECT escort_client_id FROM client_model_interactions WHERE id = ? AND model_id = ?',
            [interactionId, modelId]
        );

        if (interactionCheck.length === 0) {
            return res.fail(404, 'Client interaction not found' );
        }

        const updateFields = [];
        const params = [];

        if (method_type) {
            updateFields.push('method_type = ?');
            params.push(method_type);
        }
        if (details !== undefined) {
            updateFields.push('details = ?');
            params.push(details);
        }
        if (status) {
            updateFields.push('status = ?');
            params.push(status);
        }

        if (updateFields.length === 0) {
            return res.fail(400, 'No fields to update' );
        }

        updateFields.push('updated_at = NOW()');
        params.push(methodId, interactionId);

        const updateSql = `
            UPDATE client_screening_methods 
            SET ${updateFields.join(', ')}
            WHERE id = ? AND client_model_interaction_id = ?`;

        const result = await db.query(updateSql, params);

        if (result.affectedRows === 0) {
            return res.fail(404, 'Screening method not found' );
        }

        res.success({});
    } catch (error) {
        console.error('Update screening method error:', error);
        res.fail(500, 'Failed to update screening method' );
    }
});

// POST /api/v1/screening/:interactionId/files - Upload screening file
router.post('/:interactionId/files', upload.single('file'), async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId } = req.params;

        if (!req.file) {
            return res.fail(400, 'No file uploaded' );
        }

        // Verify interaction belongs to this model
        const interactionCheck = await db.query(
            'SELECT escort_client_id FROM client_model_interactions WHERE id = ? AND model_id = ?',
            [interactionId, modelId]
        );

        if (interactionCheck.length === 0) {
            return res.fail(404, 'Client interaction not found' );
        }

        const escortClientId = interactionCheck[0].escort_client_id;

        // Store file info in database
        const result = await db.query(
            'INSERT INTO client_screening_files (client_model_interaction_id, file_name, file_path, file_size, file_type, uploaded_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [interactionId, req.file.filename, req.file.path, req.file.size, req.file.mimetype]
        );

        res.json({
            success: true,
            data: {
                id: result.insertId,
                file_name: req.file.filename,
                file_size: req.file.size,
                file_type: req.file.mimetype,
                uploaded_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Upload screening file error:', error);
        res.fail(500, 'Failed to upload file' );
    }
});

// DELETE /api/v1/screening/:interactionId/files/:fileId - Delete screening file
router.delete('/:interactionId/files/:fileId', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId, fileId } = req.params;

        // Verify interaction belongs to this model and get file info
        const fileCheck = await db.query(`
            SELECT csf.file_path 
            FROM client_screening_files csf
            JOIN client_model_interactions cmi ON cmi.id = csf.client_model_interaction_id
            WHERE csf.id = ? AND csf.client_model_interaction_id = ? AND cmi.model_id = ?
        `, [fileId, interactionId, modelId]);

        if (fileCheck.length === 0) {
            return res.fail(404, 'File not found' );
        }

        const filePath = fileCheck[0].file_path;

        // Delete from database
        await db.query(
            'DELETE FROM client_screening_files WHERE id = ? AND client_model_interaction_id = ?',
            [fileId, interactionId]
        );

        // Delete physical file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.success({});
    } catch (error) {
        console.error('Delete screening file error:', error);
        res.fail(500, 'Failed to delete file' );
    }
});

module.exports = router;
