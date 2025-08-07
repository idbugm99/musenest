#!/usr/bin/env node
/**
 * Test Analysis Configuration Integration
 * Verifies that MuseNest can load and use analysis configurations
 */

const ContentModerationService = require('./src/services/ContentModerationService');

async function testConfiguration() {
    console.log('🧪 Testing Analysis Configuration System...');
    
    // Mock database for testing
    const mockDb = {
        execute: async (query, params) => {
            console.log('📝 Database query:', query.replace(/\s+/g, ' ').trim());
            console.log('📝 Parameters:', params);
            
            // Mock response - no configurations found (fallback to defaults)
            return [[]];
        }
    };
    
    const service = new ContentModerationService(mockDb);
    
    try {
        // Test 1: Load configuration for public_site
        console.log('\n1️⃣ Testing public_site configuration loading...');
        const publicConfig = await service.loadAnalysisConfiguration('public_site');
        console.log('Public site config:', publicConfig ? 'FOUND' : 'NOT FOUND (expected - no DB configs yet)');
        
        // Test 2: Load configuration for paysite
        console.log('\n2️⃣ Testing paysite configuration loading...');
        const paysiteConfig = await service.loadAnalysisConfiguration('paysite');
        console.log('Paysite config:', paysiteConfig ? 'FOUND' : 'NOT FOUND (expected - no DB configs yet)');
        
        // Test 3: Test fallback to legacy rules
        console.log('\n3️⃣ Testing legacy moderation rules fallback...');
        const publicRules = await service.loadModerationRules('public_site');
        console.log('Public site rules loaded:', Object.keys(publicRules).length > 0 ? 'YES' : 'NO');
        
        const paysiteRules = await service.loadModerationRules('paysite');
        console.log('Paysite rules loaded:', Object.keys(paysiteRules).length > 0 ? 'YES' : 'NO');
        
        // Test 4: Check default rules
        console.log('\n4️⃣ Testing default rules generation...');
        const defaultPublic = service.getDefaultRules('public_site');
        const defaultPaysite = service.getDefaultRules('paysite');
        
        console.log('Default public nudity threshold:', defaultPublic.nudity_threshold?.value?.max_confidence);
        console.log('Default paysite nudity threshold:', defaultPaysite.nudity_threshold?.value?.max_confidence);
        console.log('Rules are different:', defaultPublic.nudity_threshold?.value?.max_confidence !== defaultPaysite.nudity_threshold?.value?.max_confidence);
        
        console.log('\n✅ Configuration system structure is ready!');
        console.log('📋 Next steps:');
        console.log('  1. Add analysis configurations to your database');
        console.log('  2. Test with real image uploads');
        console.log('  3. Verify AI server receives component flags');
        
    } catch (error) {
        console.error('❌ Configuration test failed:', error.message);
        console.error(error.stack);
    }
}

testConfiguration().then(() => process.exit(0));