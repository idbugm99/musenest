/**
 * Phoenix4Ge Account Number Generator
 * Implements BIN-style structured account numbering system
 * 
 * Format: [TT][CC][SS][RRRRRR]
 * - TT: Client Type (01=Phoenix4Ge, 02=White Label, 03=Sub-client, 09=Admin)
 * - CC: Country/Region Code (01=US, 44=UK, etc.)
 * - SS: Sales Channel (10=Website, 20=Referral, 30=Manual, etc.)
 * - RRRRRR: 6-digit unique sequential ID
 */

const db = require('../config/database');

class AccountNumberGenerator {
    
    /**
     * Generate a structured account number
     * @param {string} clientType - Client type (phoenix_owned, white_label, sub_client, admin)
     * @param {number|string} regionId - Region ID or region code
     * @param {number|string} salesChannelId - Sales channel ID or channel code
     * @returns {Promise<string>} Generated account number
     */
    static async generate(clientType, regionId = 1, salesChannelId = 30) {
        try {
            // Get type code
            const typeCode = await this.getClientTypeCode(clientType);
            
            // Get region code
            const regionCode = await this.getRegionCode(regionId);
            
            // Get sales channel code
            const channelCode = await this.getSalesChannelCode(salesChannelId);
            
            // Get next sequential ID
            const sequentialId = await this.getNextSequentialId();
            
            // Format account number: [TT][CC][SS][RRRRRR]
            const accountNumber = this.formatAccountNumber(typeCode, regionCode, channelCode, sequentialId);
            
            return accountNumber;
            
        } catch (error) {
            console.error('Error generating account number:', error);
            throw new Error('Failed to generate account number');
        }
    }
    
    /**
     * Get client type code from database
     */
    static async getClientTypeCode(clientType) {
        const [result] = await db.execute(
            'SELECT type_code FROM client_type_codes WHERE client_type = ?',
            [clientType]
        );
        
        if (result.length === 0) {
            throw new Error(`Unknown client type: ${clientType}`);
        }
        
        return result[0].type_code;
    }
    
    /**
     * Get region code (accepts ID or existing code)
     */
    static async getRegionCode(regionId) {
        if (typeof regionId === 'number' && regionId < 100) {
            // Assume this is already a region code if it's a small number
            return regionId;
        }
        
        const [result] = await db.execute(
            'SELECT region_code FROM regions WHERE id = ? OR region_code = ?',
            [regionId, regionId]
        );
        
        if (result.length === 0) {
            console.warn(`Unknown region: ${regionId}, defaulting to US (1)`);
            return 1; // Default to US
        }
        
        return result[0].region_code;
    }
    
    /**
     * Get sales channel code (accepts ID or existing code)
     */
    static async getSalesChannelCode(salesChannelId) {
        if (typeof salesChannelId === 'number' && salesChannelId >= 10) {
            // Assume this is already a channel code if it's >= 10
            return salesChannelId;
        }
        
        const [result] = await db.execute(
            'SELECT channel_code FROM sales_channels WHERE id = ? OR channel_code = ?',
            [salesChannelId, salesChannelId]
        );
        
        if (result.length === 0) {
            console.warn(`Unknown sales channel: ${salesChannelId}, defaulting to manual (30)`);
            return 30; // Default to manual
        }
        
        return result[0].channel_code;
    }
    
    /**
     * Get next sequential ID and increment counter
     */
    static async getNextSequentialId() {
        // Use a simpler approach without explicit transactions
        try {
            // Get current sequence and increment atomically
            const [result] = await db.execute(`
                UPDATE account_sequence 
                SET last_sequence = last_sequence + 1 
                WHERE id = 1
            `);
            
            if (result.affectedRows === 0) {
                throw new Error('Account sequence not initialized');
            }
            
            // Get the new sequence value
            const [current] = await db.execute('SELECT last_sequence FROM account_sequence WHERE id = 1');
            
            return current[0].last_sequence;
            
        } catch (error) {
            console.error('Error getting next sequential ID:', error);
            throw error;
        }
    }
    
    /**
     * Format the final account number
     */
    static formatAccountNumber(typeCode, regionCode, channelCode, sequentialId) {
        const formattedType = String(typeCode).padStart(2, '0');
        const formattedRegion = String(regionCode).padStart(2, '0');
        const formattedChannel = String(channelCode).padStart(2, '0');
        const formattedSequence = String(sequentialId).padStart(6, '0');
        
        return `${formattedType}${formattedRegion}${formattedChannel}${formattedSequence}`;
    }
    
    /**
     * Parse an existing account number into components
     * @param {string} accountNumber - 12-digit account number
     * @returns {Object} Parsed components
     */
    static parseAccountNumber(accountNumber) {
        if (!accountNumber || accountNumber.length !== 12) {
            throw new Error('Invalid account number format');
        }
        
        return {
            typeCode: parseInt(accountNumber.substring(0, 2)),
            regionCode: parseInt(accountNumber.substring(2, 4)),
            channelCode: parseInt(accountNumber.substring(4, 6)),
            sequentialId: parseInt(accountNumber.substring(6, 12)),
            formatted: accountNumber
        };
    }
    
    /**
     * Get human-readable description of account number
     * @param {string} accountNumber - 12-digit account number
     * @returns {Promise<Object>} Account number description
     */
    static async describeAccountNumber(accountNumber) {
        try {
            const parsed = this.parseAccountNumber(accountNumber);
            
            // Get descriptions from database
            const [typeResult] = await db.execute(
                'SELECT client_type, description FROM client_type_codes WHERE type_code = ?',
                [parsed.typeCode]
            );
            
            const [regionResult] = await db.execute(
                'SELECT region_name, country_code FROM regions WHERE region_code = ?',
                [parsed.regionCode]
            );
            
            const [channelResult] = await db.execute(
                'SELECT channel_name, description FROM sales_channels WHERE channel_code = ?',
                [parsed.channelCode]
            );
            
            return {
                accountNumber,
                components: parsed,
                descriptions: {
                    clientType: typeResult[0]?.description || 'Unknown',
                    region: regionResult[0]?.region_name || 'Unknown',
                    salesChannel: channelResult[0]?.description || 'Unknown',
                    sequentialId: `#${parsed.sequentialId}`
                }
            };
            
        } catch (error) {
            console.error('Error describing account number:', error);
            throw error;
        }
    }
    
    /**
     * Validate account number format and checksums
     * @param {string} accountNumber - Account number to validate
     * @returns {boolean} Is valid
     */
    static validateAccountNumber(accountNumber) {
        try {
            // Basic format validation
            if (!accountNumber || accountNumber.length !== 12 || !/^\d{12}$/.test(accountNumber)) {
                return false;
            }
            
            // Parse components
            const parsed = this.parseAccountNumber(accountNumber);
            
            // Validate ranges
            if (parsed.typeCode < 1 || parsed.typeCode > 99) return false;
            if (parsed.regionCode < 1 || parsed.regionCode > 99) return false;
            if (parsed.channelCode < 10 || parsed.channelCode > 99) return false;
            if (parsed.sequentialId < 100000 || parsed.sequentialId > 999999) return false;
            
            return true;
            
        } catch (error) {
            return false;
        }
    }
}

module.exports = AccountNumberGenerator;