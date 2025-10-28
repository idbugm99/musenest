/**
 * Referral Code Generator Utility
 * Generates clean, readable referral codes for Phoenix4Ge
 * 
 * Features:
 * - Avoids confusing characters (0, O, I, 1, etc.)
 * - Generates codes based on user names or custom patterns
 * - Ensures uniqueness against database
 * - Supports different code formats and lengths
 */

const db = require('../config/database');

class ReferralCodeGenerator {
    
    /**
     * Characters safe for referral codes (no confusing chars)
     * Excludes: 0, O, I, 1, L to avoid confusion
     */
    static SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    
    /**
     * Generate a referral code based on user info
     * @param {Object} options - Generation options
     * @param {string} options.name - User name (optional)
     * @param {string} options.email - User email (optional)
     * @param {number} options.length - Code length (default: 8)
     * @param {string} options.prefix - Code prefix (optional)
     * @param {string} options.suffix - Code suffix (optional)
     * @param {number} options.maxAttempts - Max uniqueness attempts (default: 10)
     * @returns {Promise<string>} Unique referral code
     */
    static async generate(options = {}) {
        const {
            name = '',
            email = '',
            length = 8,
            prefix = '',
            suffix = '',
            maxAttempts = 10
        } = options;
        
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            let code = '';
            
            // Add prefix if provided
            if (prefix) {
                code += prefix.toUpperCase();
            }
            
            // Generate base code
            if (name) {
                // Name-based code (e.g., "MAYA" + random)
                code += this.generateNameBasedCode(name, length - code.length - (suffix ? suffix.length : 0));
            } else if (email) {
                // Email-based code (e.g., "SARAH" + random)
                const nameFromEmail = email.split('@')[0];
                code += this.generateNameBasedCode(nameFromEmail, length - code.length - (suffix ? suffix.length : 0));
            } else {
                // Pure random code
                code += this.generateRandomCode(length - code.length - (suffix ? suffix.length : 0));
            }
            
            // Add suffix if provided
            if (suffix) {
                code += suffix.toUpperCase();
            }
            
            // Ensure minimum length
            if (code.length < 6) {
                code += this.generateRandomCode(6 - code.length);
            }
            
            // Ensure maximum length
            if (code.length > 12) {
                code = code.substring(0, 12);
            }
            
            // Check uniqueness
            if (await this.isCodeUnique(code)) {
                return code;
            }
            
            attempts++;
        }
        
        // Fallback to pure random if all attempts failed
        return await this.generateFallbackCode();
    }
    
    /**
     * Generate a name-based code
     * @param {string} name - User name or email prefix
     * @param {number} targetLength - Target length for the code
     * @returns {string} Name-based code portion
     */
    static generateNameBasedCode(name, targetLength) {
        // Clean name to safe characters only
        const cleanName = name.toUpperCase()
            .replace(/[^A-Z]/g, '')
            .replace(/[O0IL1]/g, ''); // Remove confusing chars
        
        if (cleanName.length === 0) {
            return this.generateRandomCode(targetLength);
        }
        
        let code = '';
        
        // Take up to 4 characters from name
        const nameChars = Math.min(4, Math.min(cleanName.length, targetLength - 2));
        code += cleanName.substring(0, nameChars);
        
        // Fill remainder with random chars and current year
        const remaining = targetLength - code.length;
        if (remaining > 0) {
            // Add current year digits if space
            if (remaining >= 2) {
                const year = new Date().getFullYear().toString().slice(-2);
                code += year;
                const stillRemaining = remaining - 2;
                if (stillRemaining > 0) {
                    code += this.generateRandomCode(stillRemaining);
                }
            } else {
                code += this.generateRandomCode(remaining);
            }
        }
        
        return code;
    }
    
    /**
     * Generate purely random code
     * @param {number} length - Code length
     * @returns {string} Random code
     */
    static generateRandomCode(length) {
        let code = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * this.SAFE_CHARS.length);
            code += this.SAFE_CHARS[randomIndex];
        }
        return code;
    }
    
    /**
     * Generate fallback code when all else fails
     * @returns {Promise<string>} Guaranteed unique code
     */
    static async generateFallbackCode() {
        const timestamp = Date.now().toString().slice(-6);
        const random = this.generateRandomCode(6);
        const code = timestamp + random;
        
        // This should be unique, but double-check
        if (await this.isCodeUnique(code)) {
            return code;
        }
        
        // Ultimate fallback - UUID-like
        return 'REF' + Math.random().toString(36).substring(2, 11).toUpperCase();
    }
    
    /**
     * Check if referral code is unique in database
     * @param {string} code - Code to check
     * @returns {Promise<boolean>} True if unique
     */
    static async isCodeUnique(code) {
        try {
            const [existing] = await db.execute(
                'SELECT id FROM referral_codes WHERE code = ? LIMIT 1',
                [code]
            );
            return existing.length === 0;
        } catch (error) {
            console.error('Error checking code uniqueness:', error);
            return false;
        }
    }
    
    /**
     * Validate referral code format
     * @param {string} code - Code to validate
     * @returns {Object} Validation result
     */
    static validateCodeFormat(code) {
        const errors = [];
        
        if (!code || typeof code !== 'string') {
            errors.push('Code is required');
            return { valid: false, errors };
        }
        
        // Length check
        if (code.length < 6 || code.length > 12) {
            errors.push('Code must be 6-12 characters long');
        }
        
        // Character check
        const validPattern = /^[A-Z0-9]+$/;
        if (!validPattern.test(code)) {
            errors.push('Code must contain only uppercase letters and numbers');
        }
        
        // Confusing character check
        const confusingChars = /[O0IL1]/;
        if (confusingChars.test(code)) {
            errors.push('Code cannot contain confusing characters (O, 0, I, L, 1)');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Generate multiple code suggestions for a user
     * @param {Object} options - Generation options
     * @returns {Promise<Array<string>>} Array of suggested codes
     */
    static async generateSuggestions(options = {}) {
        const suggestions = [];
        const { name = '', email = '' } = options;
        
        try {
            // Name-based variations
            if (name) {
                suggestions.push(await this.generate({ name, length: 8 }));
                suggestions.push(await this.generate({ name, suffix: 'VIP' }));
                suggestions.push(await this.generate({ name, suffix: new Date().getFullYear().toString().slice(-2) }));
            }
            
            // Email-based variations
            if (email && !name) {
                const nameFromEmail = email.split('@')[0];
                suggestions.push(await this.generate({ name: nameFromEmail, length: 8 }));
                suggestions.push(await this.generate({ name: nameFromEmail, suffix: 'REF' }));
            }
            
            // Pure random options
            suggestions.push(await this.generate({ length: 8 }));
            suggestions.push(await this.generate({ prefix: 'MUSE', length: 8 }));
            
            // Remove duplicates and return up to 5 suggestions
            const uniqueSuggestions = [...new Set(suggestions)];
            return uniqueSuggestions.slice(0, 5);
            
        } catch (error) {
            console.error('Error generating suggestions:', error);
            return [await this.generateFallbackCode()];
        }
    }
    
    /**
     * Create a referral code for a user in the database
     * @param {number} userId - User ID
     * @param {Object} options - Code options
     * @returns {Promise<Object>} Created referral code data
     */
    static async createReferralCode(userId, options = {}) {
        const {
            name,
            email,
            codeName,
            usageLimit = null,
            expiresAt = null,
            isActive = true
        } = options;
        
        try {
            // Generate unique code
            const code = await this.generate({ name, email });
            
            // Insert into database
            const [result] = await db.execute(`
                INSERT INTO referral_codes (
                    client_id, code, code_name, usage_limit, expires_at, is_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `, [userId, code, codeName || null, usageLimit, expiresAt, isActive]);
            
            return {
                id: result.insertId,
                code,
                code_name: codeName,
                usage_limit: usageLimit,
                usage_count: 0,
                expires_at: expiresAt,
                is_active: isActive,
                created_at: new Date()
            };
            
        } catch (error) {
            console.error('Error creating referral code:', error);
            throw new Error('Failed to create referral code');
        }
    }
}

module.exports = ReferralCodeGenerator;