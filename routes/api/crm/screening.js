const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../../../config/database');

// Auth middleware: reuse CRM session
async function requireCRMAuth(req, res, next) {
	const { slug } = req.params;
	if (req.session.crm && req.session.crm.modelSlug === slug && req.session.crm.authenticated) {
		return next();
	}
	return res.status(401).json({ success: false, error: 'Unauthorized' });
}

// Storage for screening files under escort_client folder
const upload = multer({ dest: path.join(__dirname, '../../../temp_uploads') });

function ensureDirSync(dir) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Migration helper: ensure table exists
async function ensureTables() {
	await query(`CREATE TABLE IF NOT EXISTS client_screening_methods (
		id INT AUTO_INCREMENT PRIMARY KEY,
		client_model_interaction_id INT NOT NULL,
		escort_client_id INT NOT NULL,
		model_id INT NOT NULL,
		method_slug VARCHAR(50) NOT NULL,
		method_label VARCHAR(100) NOT NULL,
		checked TINYINT(1) DEFAULT 0,
		notes TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		UNIQUE KEY uniq_method (client_model_interaction_id, method_slug),
		INDEX idx_client (escort_client_id),
		INDEX idx_model (model_id)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

	await query(`CREATE TABLE IF NOT EXISTS client_screening_files (
		id INT AUTO_INCREMENT PRIMARY KEY,
		escort_client_id INT NOT NULL,
		client_model_interaction_id INT NOT NULL,
		model_id INT NOT NULL,
		file_path VARCHAR(255) NOT NULL,
		original_name VARCHAR(255),
		mime_type VARCHAR(100),
		size INT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		INDEX idx_client (escort_client_id),
		INDEX idx_cmi (client_model_interaction_id)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
}

// Default screening catalog
const DEFAULT_METHODS = [
	{ slug: 'gov_id_selfie', label: 'Government ID & selfie' },
	{ slug: 'p411', label: 'P411 / validation site' },
	{ slug: 'escort_refs', label: 'Escort references' },
	{ slug: 'social', label: 'Social media / LinkedIn' },
	{ slug: 'video_chat', label: 'Video chat' },
	{ slug: 'background', label: 'Background tools / gut check' },
	{ slug: 'other', label: 'Other (custom)' }
];

// Fetch screening methods for a client
router.get('/:slug/screening/:interactionId', requireCRMAuth, async (req, res) => {
	await ensureTables();
	const { interactionId } = req.params;
	const rows = await query(`SELECT * FROM client_screening_methods WHERE client_model_interaction_id = ?`, [interactionId]);
	if (rows.length === 0) {
		return res.json({ success: true, data: DEFAULT_METHODS.map(m => ({ ...m, checked: 0, notes: null })) });
	}
	res.json({ success: true, data: rows });
});

// Save/update screening methods
router.post('/:slug/screening/:interactionId', requireCRMAuth, async (req, res) => {
	await ensureTables();
	const { interactionId, slug } = req.params;
	const { modelId } = req.session.crm;
	let { escortClientId, methods } = req.body; // methods: [{slug,label,checked,notes}]
	try {
		if (!escortClientId) {
			const found = await query(`SELECT escort_client_id FROM client_model_interactions WHERE id = ? LIMIT 1`, [interactionId]);
			escortClientId = found.length ? found[0].escort_client_id : null;
		}
		if (!escortClientId) return res.status(400).json({ success: false, error: 'escortClientId not found for interaction' });
		for (const m of methods || []) {
			await query(`INSERT INTO client_screening_methods (client_model_interaction_id, escort_client_id, model_id, method_slug, method_label, checked, notes)
				VALUES (?, ?, ?, ?, ?, ?, ?)
				ON DUPLICATE KEY UPDATE checked = VALUES(checked), notes = VALUES(notes), updated_at = CURRENT_TIMESTAMP`,
				[interactionId, escortClientId, modelId, m.slug, m.label || m.slug, m.checked ? 1 : 0, m.notes || null]
			);
		}
		res.json({ success: true });
	} catch (e) {
		console.error('Save screening methods failed:', e);
		res.status(500).json({ success: false, error: 'Failed to save screening' });
	}
});

// Upload screening file(s)
router.post('/:slug/screening/:interactionId/upload', requireCRMAuth, upload.array('files', 10), async (req, res) => {
	await ensureTables();
	const { interactionId } = req.params;
	const { modelId } = req.session.crm;
	let { escortClientId } = req.body;
	try {
		if (!escortClientId) {
			const found = await query(`SELECT escort_client_id FROM client_model_interactions WHERE id = ? LIMIT 1`, [interactionId]);
			escortClientId = found.length ? found[0].escort_client_id : null;
		}
		if (!escortClientId) return res.status(400).json({ success: false, error: 'escortClientId not found for interaction' });
		const baseDir = path.join(__dirname, '../../../public/uploads/screening', String(escortClientId));
		ensureDirSync(baseDir);
		const saved = [];
		for (const file of req.files || []) {
			const ext = path.extname(file.originalname);
			const dest = path.join(baseDir, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
			fs.renameSync(file.path, dest);
			await query(`INSERT INTO client_screening_files (escort_client_id, client_model_interaction_id, model_id, file_path, original_name, mime_type, size)
				VALUES (?, ?, ?, ?, ?, ?, ?)`, [escortClientId, interactionId, modelId, dest.replace(path.join(__dirname, '../../../'), '/'), file.originalname, file.mimetype, file.size]);
			saved.push({ file: dest, name: file.originalname });
		}
		res.json({ success: true, files: saved });
	} catch (e) {
		console.error('Upload screening files failed:', e);
		res.status(500).json({ success: false, error: 'Failed to upload files' });
	}
});

// List screening files
router.get('/:slug/screening/:interactionId/files', requireCRMAuth, async (req, res) => {
	const { interactionId } = req.params;
	const files = await query(`SELECT id, file_path, original_name, created_at FROM client_screening_files WHERE client_model_interaction_id = ? ORDER BY created_at DESC`, [interactionId]);
	res.json({ success: true, files });
});

module.exports = router;
