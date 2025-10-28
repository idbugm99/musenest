const { query } = require('../config/database');
const crypto = require('crypto');

class ClientResolverService {
	constructor() {}

	static hashOrNull(value) {
		if (!value) return null;
		return crypto.createHash('sha256').update(value.toString().trim().toLowerCase()).digest('hex');
	}

	async resolveOrCreateClient({ modelId, name, email, phone }) {
		const phoneHash = ClientResolverService.hashOrNull(phone);
		const emailHash = ClientResolverService.hashOrNull(email);

		// Try to find existing escort_client by phone/email hash
		let client = await query(
			`SELECT * FROM escort_clients WHERE (phone_hash = ? AND phone_hash IS NOT NULL) OR (email_hash = ? AND email_hash IS NOT NULL) LIMIT 1`,
			[phoneHash, emailHash]
		);

		let escortClientId;
		if (client.length > 0) {
			escortClientId = client[0].id;
		} else {
			const res = await query(
				`INSERT INTO escort_clients (model_id, client_identifier, phone_hash, email_hash, created_at, updated_at)
				 VALUES (?, ?, ?, ?, NOW(), NOW())`,
				[modelId || null, name || email || phone || 'Unknown', phoneHash, emailHash]
			);
			escortClientId = res.insertId;
		}

		// Resolve or create interaction for this model
		const existing = await query(
			`SELECT id FROM client_model_interactions WHERE escort_client_id = ? AND model_id = ? LIMIT 1`,
			[escortClientId, modelId]
		);
		let interactionId;
		if (existing.length > 0) {
			interactionId = existing[0].id;
		} else {
			const ins = await query(
				`INSERT INTO client_model_interactions (escort_client_id, model_id, screening_status, client_category, created_at, updated_at)
				 VALUES (?, ?, 'pending', 'unscreened', NOW(), NOW())`,
				[escortClientId, modelId]
			);
			interactionId = ins.insertId;
		}

		return { escortClientId, interactionId };
	}
}

module.exports = ClientResolverService;
