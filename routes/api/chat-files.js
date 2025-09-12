const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Database connection
const { query } = require('../../config/database');
const FileUploadService = require('../../services/FileUploadService');

// Rate limiting for file uploads - more restrictive than chat messages
const fileUploadRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 file uploads per 5 minutes
  message: { error: 'Too many file uploads. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const approvalSchema = z.object({
  is_approved: z.boolean(),
  notes: z.string().optional()
});

// Upload files to conversation
router.post('/upload/:conversation_id', fileUploadRateLimit, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversation_id);
    const uploaderType = req.body.uploader_type || 'contact'; // 'contact' or 'model'
    
    if (!conversationId || isNaN(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Verify conversation exists and get model info
    const conversation = await query(`
      SELECT c.*, cmi.contact_id, cmi.model_id, m.chat_enabled 
      FROM conversations c
      JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
      LEFT JOIN models m ON cmi.model_id = m.slug OR cmi.model_id = m.id
      WHERE c.id = ?
    `, [conversationId]);

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conv = conversation[0];
    
    // Check storage quota
    const hasQuota = await FileUploadService.checkStorageQuota(conv.model_id, req.body.total_size || 0);
    if (!hasQuota) {
      return res.status(413).json({ error: 'Storage quota exceeded' });
    }

    // Configure multer for this conversation
    const upload = FileUploadService.getMulterConfig(conversationId);
    
    // Process file upload
    upload.array('files', 5)(req, res, async (err) => {
      if (err) {
        console.error('File upload error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'Too many files' });
        }
        return res.status(400).json({ error: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const processedFiles = [];
      const errors = [];

      // Process each uploaded file
      for (const file of req.files) {
        try {
          const processedFile = await FileUploadService.processUploadedFile(
            file, conversationId, uploaderType, conv.model_id
          );
          processedFiles.push(processedFile);
        } catch (error) {
          console.error('File processing error:', error);
          errors.push({
            filename: file.originalname,
            error: error.message
          });
        }
      }

      // Update conversation last activity
      await query(`
        UPDATE conversations 
        SET last_file_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [conversationId]);

      res.json({
        success: true,
        uploaded: processedFiles.length,
        files: processedFiles,
        errors: errors.length > 0 ? errors : undefined
      });
    });

  } catch (error) {
    console.error('Chat file upload error:', error);
    res.status(500).json({
      error: 'An error occurred while uploading files'
    });
  }
});

// Get files for a conversation
router.get('/conversation/:conversation_id', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversation_id);
    const approvedOnly = req.query.approved_only === 'true';
    
    if (!conversationId || isNaN(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Verify conversation access
    const conversation = await query(`
      SELECT id FROM conversations WHERE id = ?
    `, [conversationId]);

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const files = await FileUploadService.getConversationFiles(conversationId, approvedOnly);
    
    res.json({
      success: true,
      files: files
    });

  } catch (error) {
    console.error('Get conversation files error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching files'
    });
  }
});

// Download/serve file
router.get('/download/:attachment_id', async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachment_id);
    
    if (!attachmentId || isNaN(attachmentId)) {
      return res.status(400).json({ error: 'Invalid attachment ID' });
    }

    const file = await FileUploadService.getFileById(attachmentId);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if file is approved (unless it's the uploader viewing their own file)
    const viewerType = req.query.viewer_type;
    if (!file.is_approved && viewerType !== file.uploaded_by) {
      return res.status(403).json({ error: 'File pending approval' });
    }

    const filePath = FileUploadService.getFilePath(file);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
    res.setHeader('Content-Type', file.mime_type);
    
    // Send file
    res.sendFile(path.resolve(filePath));

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      error: 'An error occurred while downloading file'
    });
  }
});

// Get thumbnail for image
router.get('/thumbnail/:attachment_id', async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachment_id);
    const size = parseInt(req.query.size) || 300;
    
    if (!attachmentId || isNaN(attachmentId)) {
      return res.status(400).json({ error: 'Invalid attachment ID' });
    }

    const file = await FileUploadService.getFileById(attachmentId);
    
    if (!file || file.file_type !== 'image') {
      return res.status(404).json({ error: 'Image not found' });
    }

    const thumbnailPath = FileUploadService.getThumbnailPath(file, size);
    
    if (!thumbnailPath) {
      return res.status(404).json({ error: 'Thumbnail not available' });
    }

    // Check if thumbnail exists
    try {
      await fs.access(thumbnailPath);
    } catch (error) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.sendFile(path.resolve(thumbnailPath));

  } catch (error) {
    console.error('Thumbnail error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching thumbnail'
    });
  }
});

// Approve or reject file (model/admin only)
router.put('/approve/:attachment_id', async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachment_id);
    
    if (!attachmentId || isNaN(attachmentId)) {
      return res.status(400).json({ error: 'Invalid attachment ID' });
    }

    const validationResult = approvalSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    const { is_approved, notes } = validationResult.data;

    const file = await FileUploadService.getFileById(attachmentId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await FileUploadService.updateFileApproval(attachmentId, is_approved, notes);
    
    res.json({
      success: true,
      attachment_id: attachmentId,
      is_approved,
      notes
    });

  } catch (error) {
    console.error('File approval error:', error);
    res.status(500).json({
      error: 'An error occurred while updating file approval'
    });
  }
});

// Delete file
router.delete('/:attachment_id', async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachment_id);
    
    if (!attachmentId || isNaN(attachmentId)) {
      return res.status(400).json({ error: 'Invalid attachment ID' });
    }

    const file = await FileUploadService.getFileById(attachmentId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await FileUploadService.deleteFile(attachmentId);
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      error: 'An error occurred while deleting file'
    });
  }
});

// Get pending approvals (for model dashboard)
router.get('/pending-approvals/:model_id', async (req, res) => {
  try {
    const modelId = req.params.model_id;
    
    const pendingFiles = await query(`
      SELECT 
        ca.id, ca.filename, ca.original_filename, ca.file_type, 
        ca.file_size, ca.uploaded_at, ca.uploaded_by,
        c.id as conversation_id, c.subject,
        cont.name as contact_name, cont.email as contact_email
      FROM chat_attachments ca
      JOIN conversations c ON ca.conversation_id = c.id
      JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
      JOIN contacts cont ON cmi.contact_id = cont.id
      WHERE cmi.model_id = ? AND ca.is_approved = FALSE
      ORDER BY ca.uploaded_at ASC
    `, [modelId]);

    res.json({
      success: true,
      pending_files: pendingFiles
    });

  } catch (error) {
    console.error('Pending approvals error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching pending approvals'
    });
  }
});

// Get file statistics
router.get('/stats/:model_id', async (req, res) => {
  try {
    const modelId = req.params.model_id;
    
    const stats = await query(`
      SELECT 
        COUNT(*) as total_files,
        SUM(CASE WHEN is_approved = TRUE THEN 1 ELSE 0 END) as approved_files,
        SUM(CASE WHEN is_approved = FALSE THEN 1 ELSE 0 END) as pending_files,
        SUM(file_size) as total_size,
        COUNT(DISTINCT conversation_id) as conversations_with_files
      FROM chat_attachments ca
      JOIN conversations c ON ca.conversation_id = c.id
      JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
      WHERE cmi.model_id = ?
    `, [modelId]);

    const typeStats = await query(`
      SELECT 
        file_type,
        COUNT(*) as count,
        SUM(file_size) as total_size
      FROM chat_attachments ca
      JOIN conversations c ON ca.conversation_id = c.id
      JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
      WHERE cmi.model_id = ?
      GROUP BY file_type
    `, [modelId]);

    res.json({
      success: true,
      stats: stats[0] || {},
      type_breakdown: typeStats
    });

  } catch (error) {
    console.error('File stats error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching file statistics'
    });
  }
});

module.exports = router;