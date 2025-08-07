/**
 * Script to generate account numbers for existing admin models
 * This will update existing admin models with proper account numbers
 */

const db = require('../config/database');
const AccountNumberGenerator = require('../utils/account-number-generator');

async function generateAdminAccountNumbers() {
    try {
        console.log('🔢 Generating account numbers for existing admin models...');
        
        // Get all admin models without account numbers
        const [adminModels] = await db.execute(`
            SELECT id, name, client_type 
            FROM models 
            WHERE client_type = 'admin' AND (account_number IS NULL OR account_number = '')
        `);
        
        console.log(`Found ${adminModels.length} admin models without account numbers`);
        
        for (const model of adminModels) {
            // Generate account number for admin type with system channel
            const accountNumber = await AccountNumberGenerator.generate(
                'admin',    // client_type
                99,         // region_code (International)
                99          // sales_channel_code (System)
            );
            
            // Update the model with account number and system settings
            await db.execute(`
                UPDATE models 
                SET account_number = ?,
                    sales_channel_id = (SELECT id FROM sales_channels WHERE channel_code = 99),
                    region_id = (SELECT id FROM regions WHERE region_code = 99)
                WHERE id = ?
            `, [accountNumber, model.id]);
            
            console.log(`✅ Generated account number ${accountNumber} for ${model.name}`);
        }
        
        console.log('🎉 Account number generation complete!');
        
        // Display summary
        const [allAccounts] = await db.execute(`
            SELECT account_number, name, client_type 
            FROM models 
            WHERE account_number IS NOT NULL 
            ORDER BY account_number
        `);
        
        console.log('\n📋 Account Number Summary:');
        console.log('Account Number | Client Name      | Type');
        console.log('---------------|------------------|----------');
        
        for (const account of allAccounts) {
            console.log(`${account.account_number} | ${account.name.padEnd(16)} | ${account.client_type}`);
        }
        
    } catch (error) {
        console.error('❌ Error generating account numbers:', error);
    } finally {
        process.exit(0);
    }
}

// Run the script
generateAdminAccountNumbers();