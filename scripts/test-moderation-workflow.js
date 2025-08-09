#!/usr/bin/env node

/**
 * Moderation Workflow Test Runner
 * Part of Phase B.7: Test Complete Moderation Workflow End-to-End
 * Convenience script to run the complete workflow integration test
 */

const path = require('path');
const ModerationWorkflowTest = require('../tests/integration/moderation-workflow-test');

console.log('🧪 MuseNest Moderation Workflow Test Suite');
console.log('==========================================');
console.log('Testing complete end-to-end moderation workflow integration...\n');

// Load environment variables
require('dotenv').config();

async function runWorkflowTest() {
    try {
        const test = new ModerationWorkflowTest();
        const results = await test.runCompleteWorkflowTest();
        
        console.log('\n🏁 Test execution completed.');
        
        if (results.failed === 0) {
            console.log('✅ SUCCESS: All workflow components are properly integrated and operational.');
            process.exit(0);
        } else {
            console.log(`❌ FAILURE: ${results.failed} test(s) failed. Please review the test output above.`);
            process.exit(1);
        }
        
    } catch (error) {
        console.error('💥 Test execution failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error.message);
    console.error(error.stack);
    process.exit(1);
});

// Run the test
runWorkflowTest();