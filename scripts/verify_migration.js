const db = require('../config/database');

async function verifyMigration() {
    console.log('🔍 Verifying migration from old to new configuration system...\n');
    
    try {
        // Check old system
        console.log('📋 OLD SYSTEM (moderation_rules_config):');
        const [oldRules] = await db.execute(`
            SELECT usage_intent, rule_name, rule_type, rule_value 
            FROM moderation_rules_config 
            WHERE is_active = TRUE 
            ORDER BY usage_intent, rule_name
        `);
        
        const oldByIntent = {};
        oldRules.forEach(rule => {
            if (!oldByIntent[rule.usage_intent]) {
                oldByIntent[rule.usage_intent] = {};
            }
            try {
                // Handle both string and object rule values
                const ruleValue = typeof rule.rule_value === 'string' 
                    ? JSON.parse(rule.rule_value) 
                    : rule.rule_value;
                oldByIntent[rule.usage_intent][rule.rule_name] = ruleValue;
            } catch (parseError) {
                console.warn(`Failed to parse rule ${rule.rule_name} for ${rule.usage_intent}:`, rule.rule_value);
                oldByIntent[rule.usage_intent][rule.rule_name] = rule.rule_value;
            }
        });
        
        Object.keys(oldByIntent).forEach(intent => {
            console.log(`  ${intent}:`);
            Object.keys(oldByIntent[intent]).forEach(ruleName => {
                console.log(`    ${ruleName}: ${JSON.stringify(oldByIntent[intent][ruleName])}`);
            });
            console.log('');
        });
        
        // Check new system
        console.log('📋 NEW SYSTEM (analysis_configurations):');
        const [newConfigs] = await db.execute(`
            SELECT usage_intent, detection_config, scoring_config, blip_config
            FROM analysis_configurations 
            WHERE is_active = TRUE 
            ORDER BY usage_intent
        `);
        
        newConfigs.forEach(config => {
            console.log(`  ${config.usage_intent}:`);
            try {
                const detectionConfig = typeof config.detection_config === 'string' 
                    ? JSON.parse(config.detection_config) 
                    : config.detection_config;
                const scoringConfig = typeof config.scoring_config === 'string' 
                    ? JSON.parse(config.scoring_config) 
                    : config.scoring_config;
                const blipConfig = typeof config.blip_config === 'string' 
                    ? JSON.parse(config.blip_config) 
                    : config.blip_config;
                    
                console.log(`    Detection: ${JSON.stringify(detectionConfig)}`);
                console.log(`    Scoring: ${JSON.stringify(scoringConfig)}`);
                console.log(`    BLIP: ${JSON.stringify(blipConfig)}`);
            } catch (parseError) {
                console.error(`    ❌ Failed to parse config for ${config.usage_intent}:`, parseError.message);
            }
            console.log('');
        });
        
        // Test configuration loading
        console.log('🧪 Testing Configuration Loading:');
        const ContentModerationService = require('../src/services/ContentModerationService');
        const service = new ContentModerationService(db);
        
        const testIntents = ['public_site', 'paysite', 'store', 'private'];
        
        for (const intent of testIntents) {
            console.log(`\n  Testing ${intent}:`);
            
            const config = await service.loadAnalysisConfiguration(intent);
            if (config) {
                console.log(`    ✅ Configuration loaded successfully`);
                console.log(`    📊 Nudity weights: BREAST=${config.scoring_config.detection_weights.BREAST_EXPOSED}, GENITALIA=${config.scoring_config.detection_weights.GENITALIA}`);
                console.log(`    🎯 Thresholds: approve<${config.scoring_config.thresholds.auto_approve_under}, flag>${config.scoring_config.thresholds.auto_flag_over}`);
                console.log(`    🔍 Components: breast=${config.detection_config.nudenet_components.breast_detection}, face=${config.detection_config.nudenet_components.face_detection}`);
            } else {
                console.log(`    ❌ Failed to load configuration`);
            }
        }
        
        console.log('\n✅ Migration verification complete!');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        process.exit(0);
    }
}

verifyMigration();