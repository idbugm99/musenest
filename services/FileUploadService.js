const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const { query } = require('../config/database');

class FileUploadService {
  constructor() {
    this.uploadPath = path.join(process.cwd(), 'uploads');
    this.tempPath = path.join(this.uploadPath, 'temp');
    this.conversationPath = path.join(this.uploadPath, 'conversations');
    
    // Configuration
    this.maxFileSize = 10 * 1024 * 1024; // 10MB default
    this.allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain', 'text/csv',
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    this.autoApproveTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'text/plain'
    ];
    
    this.thumbnailSizes = [150, 300, 800];
  }

  // Configure multer for file uploads
  getMulterConfig(conversationId) {
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          const tempDir = path.join(this.tempPath, 'uploads');
          await this.ensureDirectory(tempDir);
          cb(null, tempDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const ext = path.extname(file.originalname);
        const filename = `${uniqueId}${ext}`;
        cb(null, filename);
      }
    });

    const fileFilter = (req, file, cb) => {
      // Basic MIME type check (will be validated more thoroughly later)
      if (this.allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed`), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 5 // Max 5 files per upload
      }
    });
  }

  // Ensure directory exists
  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  // Validate file type using file content
  async validateFileType(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const { fileTypeFromBuffer } = await import('file-type');
      const fileType = await fileTypeFromBuffer(buffer);
      
      if (!fileType) {
        // For text files, fileTypeFromBuffer might return null
        const stats = await fs.stat(filePath);
        if (stats.size < 1024 * 1024) { // Only allow small text files without mime detection
          return { mime: 'text/plain', ext: 'txt' };
        }
        throw new Error('Cannot determine file type');
      }
      
      if (!this.allowedTypes.includes(fileType.mime)) {
        throw new Error(`File type ${fileType.mime} not allowed`);
      }
      
      return fileType;
    } catch (error) {
      throw new Error(`File validation failed: ${error.message}`);
    }
  }

  // Determine file category
  getFileCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('document') || 
        mimeType.includes('sheet') || mimeType.includes('text')) return 'document';
    return 'other';
  }

  // Generate thumbnail for images
  async generateThumbnail(inputPath, outputPath, size = 300) {
    try {
      await sharp(inputPath)
        .resize(size, size, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toFile(outputPath);
      return true;
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return false;
    }
  }

  // Move file to permanent location
  async moveToConversationFolder(tempFilePath, conversationId, modelId, filename, fileCategory) {
    const conversationDir = path.join(this.conversationPath, modelId, conversationId.toString(), fileCategory);
    await this.ensureDirectory(conversationDir);
    
    const finalPath = path.join(conversationDir, filename);
    await fs.rename(tempFilePath, finalPath);
    
    // Generate thumbnail for images
    if (fileCategory === 'image') {
      const thumbnailDir = path.join(conversationDir, 'thumbnails');
      await this.ensureDirectory(thumbnailDir);
      
      for (const size of this.thumbnailSizes) {
        const thumbnailPath = path.join(thumbnailDir, `${path.parse(filename).name}_${size}.jpg`);
        await this.generateThumbnail(finalPath, thumbnailPath, size);
      }
    }
    
    return path.relative(this.uploadPath, finalPath);
  }

  // Process uploaded file
  async processUploadedFile(file, conversationId, uploaderType, modelId) {
    const tempFilePath = file.path;
    const originalFilename = file.originalname;
    
    try {
      // Validate file type by content
      const fileType = await this.validateFileType(tempFilePath);
      const fileCategory = this.getFileCategory(fileType.mime);
      
      // Get file size
      const stats = await fs.stat(tempFilePath);
      const fileSize = stats.size;
      
      // Generate unique filename
      const uniqueId = uuidv4();
      const ext = path.extname(originalFilename) || `.${fileType.ext}`;
      const filename = `${uniqueId}${ext}`;
      
      // Move to permanent location
      const storagePath = await this.moveToConversationFolder(
        tempFilePath, conversationId, modelId, filename, fileCategory
      );
      
      // Determine if auto-approved
      const isAutoApproved = this.autoApproveTypes.includes(fileType.mime);
      
      // Save to database
      const result = await query(`
        INSERT INTO chat_attachments (
          conversation_id, filename, original_filename, file_type, 
          file_size, mime_type, storage_path, uploaded_by, is_approved
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        conversationId, filename, originalFilename, fileCategory,
        fileSize, fileType.mime, storagePath, uploaderType, isAutoApproved
      ]);
      
      return {
        id: result.insertId,
        filename,
        originalFilename,
        fileType: fileCategory,
        fileSize,
        mimeType: fileType.mime,
        storagePath,
        isApproved: isAutoApproved,
        uploadedBy: uploaderType
      };
      
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        console.error('Error cleaning up temp file:', unlinkError);
      }
      throw error;
    }
  }

  // Get conversation files
  async getConversationFiles(conversationId, approvedOnly = false) {
    const whereClause = approvedOnly ? 
      'WHERE conversation_id = ? AND is_approved = TRUE' : 
      'WHERE conversation_id = ?';
      
    const files = await query(`
      SELECT id, filename, original_filename, file_type, file_size, 
             mime_type, uploaded_by, uploaded_at, is_approved, approval_notes
      FROM chat_attachments 
      ${whereClause}
      ORDER BY uploaded_at DESC
    `, [conversationId]);
    
    return files;
  }

  // Get file info by ID
  async getFileById(attachmentId) {
    const files = await query(`
      SELECT ca.*, c.contact_model_interaction_id
      FROM chat_attachments ca
      JOIN conversations c ON ca.conversation_id = c.id
      WHERE ca.id = ?
    `, [attachmentId]);
    
    return files[0] || null;
  }

  // Approve/reject file
  async updateFileApproval(attachmentId, isApproved, notes = null) {
    await query(`
      UPDATE chat_attachments 
      SET is_approved = ?, approval_notes = ?
      WHERE id = ?
    `, [isApproved, notes, attachmentId]);
  }

  // Delete file
  async deleteFile(attachmentId) {
    const file = await this.getFileById(attachmentId);
    if (!file) {
      throw new Error('File not found');
    }
    
    // Delete physical file
    const fullPath = path.join(this.uploadPath, file.storage_path);
    try {
      await fs.unlink(fullPath);
      
      // Delete thumbnails if image
      if (file.file_type === 'image') {
        const thumbnailDir = path.join(path.dirname(fullPath), 'thumbnails');
        const baseName = path.parse(file.filename).name;
        
        for (const size of this.thumbnailSizes) {
          const thumbnailPath = path.join(thumbnailDir, `${baseName}_${size}.jpg`);
          try {
            await fs.unlink(thumbnailPath);
          } catch (error) {
            // Thumbnail might not exist, ignore
          }
        }
      }
    } catch (error) {
      console.error('Error deleting physical file:', error);
    }
    
    // Delete database record
    await query('DELETE FROM chat_attachments WHERE id = ?', [attachmentId]);
  }

  // Get file path for serving
  getFilePath(file) {
    return path.join(this.uploadPath, file.storage_path);
  }

  // Get thumbnail path
  getThumbnailPath(file, size = 300) {
    if (file.file_type !== 'image') return null;
    
    const basePath = path.join(this.uploadPath, file.storage_path);
    const dir = path.dirname(basePath);
    const baseName = path.parse(file.filename).name;
    
    return path.join(dir, 'thumbnails', `${baseName}_${size}.jpg`);
  }

  // Check storage quota (if needed)
  async checkStorageQuota(modelId, additionalSize = 0) {
    const quota = 500 * 1024 * 1024; // 500MB default
    
    const result = await query(`
      SELECT SUM(ca.file_size) as total_size
      FROM chat_attachments ca
      JOIN conversations c ON ca.conversation_id = c.id
      JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
      WHERE cmi.model_id = ?
    `, [modelId]);
    
    const currentSize = result[0]?.total_size || 0;
    return (currentSize + additionalSize) <= quota;
  }
}

module.exports = new FileUploadService();