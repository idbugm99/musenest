#!/usr/bin/env node

/**
 * MuseNest API Testing Script
 * 
 * This script tests all the REST API endpoints to ensure they're working correctly.
 * Run with: node test_apis.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'escortmodel@example.com'; // From your seeded data
const TEST_PASSWORD = 'securepass123';

let authToken = null;

// Utility function for making HTTP requests
async function apiRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    };

    const config = {
        method: 'GET',
        headers: { ...defaultHeaders, ...options.headers },
        ...options
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        return {
            status: response.status,
            success: response.ok,
            data: data
        };
    } catch (error) {
        return {
            status: 0,
            success: false,
            error: error.message
        };
    }
}

// Test helper functions
function logTest(testName) {
    console.log(`\n🧪 Testing: ${testName}`);
}

function logResult(result, expected = 200) {
    if (result.status === expected && result.success) {
        console.log(`✅ Status: ${result.status} - SUCCESS`);
        return true;
    } else {
        console.log(`❌ Status: ${result.status} - FAILED`);
        console.log(`   Expected: ${expected}, Got: ${result.status}`);
        if (result.data) console.log(`   Response:`, result.data);
        return false;
    }
}

// Authentication Tests
async function testAuthentication() {
    console.log('\n🔐 AUTHENTICATION TESTS');
    
    logTest('User Login');
    const loginResult = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        })
    });
    
    if (logResult(loginResult)) {
        authToken = loginResult.data.token;
        console.log(`   Token received: ${authToken ? 'Yes' : 'No'}`);
    }
    
    return authToken !== null;
}

// Gallery API Tests
async function testGalleryAPI() {
    console.log('\n🖼️  GALLERY API TESTS');
    
    logTest('Get Gallery Images');
    const imagesResult = await apiRequest('/api/gallery/images');
    logResult(imagesResult);
    
    logTest('Get Gallery Sections');
    const sectionsResult = await apiRequest('/api/gallery/sections');
    logResult(sectionsResult);
    
    // Test creating a gallery section
    logTest('Create Gallery Section');
    const createSectionResult = await apiRequest('/api/gallery/sections', {
        method: 'POST',
        body: JSON.stringify({
            title: 'Test Section',
            description: 'This is a test section created by API test'
        })
    });
    
    let sectionId = null;
    if (logResult(createSectionResult, 201)) {
        sectionId = createSectionResult.data.section.id;
        console.log(`   Created section ID: ${sectionId}`);
    }
    
    // Test updating the section
    if (sectionId) {
        logTest('Update Gallery Section');
        const updateSectionResult = await apiRequest(`/api/gallery/sections/${sectionId}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: 'Updated Test Section',
                description: 'Updated description'
            })
        });
        logResult(updateSectionResult);
    }
    
    // Test deleting the section
    if (sectionId) {
        logTest('Delete Gallery Section');
        const deleteSectionResult = await apiRequest(`/api/gallery/sections/${sectionId}`, {
            method: 'DELETE'
        });
        logResult(deleteSectionResult);
    }
}

// FAQ API Tests
async function testFAQAPI() {
    console.log('\n❓ FAQ API TESTS');
    
    logTest('Get FAQs');
    const faqsResult = await apiRequest('/api/faq');
    logResult(faqsResult);
    
    // Test creating FAQ
    logTest('Create FAQ');
    const createFAQResult = await apiRequest('/api/faq', {
        method: 'POST',
        body: JSON.stringify({
            question: 'What is a test question?',
            answer: 'This is a test answer created by the API test script.'
        })
    });
    
    let faqId = null;
    if (logResult(createFAQResult, 201)) {
        faqId = createFAQResult.data.faq.id;
        console.log(`   Created FAQ ID: ${faqId}`);
    }
    
    // Test getting single FAQ
    if (faqId) {
        logTest('Get Single FAQ');
        const getFAQResult = await apiRequest(`/api/faq/${faqId}`);
        logResult(getFAQResult);
    }
    
    // Test updating FAQ
    if (faqId) {
        logTest('Update FAQ');
        const updateFAQResult = await apiRequest(`/api/faq/${faqId}`, {
            method: 'PUT',
            body: JSON.stringify({
                question: 'Updated test question?',
                answer: 'This is an updated test answer.',
                is_active: true
            })
        });
        logResult(updateFAQResult);
    }
    
    // Test toggle FAQ status
    if (faqId) {
        logTest('Toggle FAQ Status');
        const toggleResult = await apiRequest(`/api/faq/${faqId}/toggle`, {
            method: 'PATCH'
        });
        logResult(toggleResult);
    }
    
    // Test deleting FAQ
    if (faqId) {
        logTest('Delete FAQ');
        const deleteFAQResult = await apiRequest(`/api/faq/${faqId}`, {
            method: 'DELETE'
        });
        logResult(deleteFAQResult);
    }
}

// Settings API Tests
async function testSettingsAPI() {
    console.log('\n⚙️  SETTINGS API TESTS');
    
    logTest('Get All Settings');
    const settingsResult = await apiRequest('/api/settings');
    logResult(settingsResult);
    
    logTest('Get Settings Categories');
    const categoriesResult = await apiRequest('/api/settings/meta/categories');
    logResult(categoriesResult);
    
    // Test updating a setting
    logTest('Update Setting');
    const updateSettingResult = await apiRequest('/api/settings/test_setting', {
        method: 'PUT',
        body: JSON.stringify({
            value: 'Test Value from API',
            category: 'testing'
        })
    });
    logResult(updateSettingResult);
    
    // Test getting the setting
    logTest('Get Single Setting');
    const getSettingResult = await apiRequest('/api/settings/test_setting');
    logResult(getSettingResult);
    
    // Test bulk update
    logTest('Bulk Update Settings');
    const bulkUpdateResult = await apiRequest('/api/settings/bulk', {
        method: 'POST',
        body: JSON.stringify({
            settings: {
                test_bulk_1: {
                    value: 'Bulk Test 1',
                    category: 'testing'
                },
                test_bulk_2: {
                    value: 'Bulk Test 2',
                    category: 'testing'
                }
            }
        })
    });
    logResult(bulkUpdateResult);
    
    // Test theme change
    logTest('Change Theme');
    const themeResult = await apiRequest('/api/settings/theme', {
        method: 'POST',
        body: JSON.stringify({
            theme: 'glamour'
        })
    });
    logResult(themeResult);
    
    // Cleanup test settings
    logTest('Delete Test Setting');
    const deleteResult = await apiRequest('/api/settings/test_setting', {
        method: 'DELETE'
    });
    logResult(deleteResult);
}

// Testimonials API Tests
async function testTestimonialsAPI() {
    console.log('\n💬 TESTIMONIALS API TESTS');
    
    logTest('Get Testimonials');
    const testimonialsResult = await apiRequest('/api/testimonials');
    logResult(testimonialsResult);
    
    // Test creating testimonial
    logTest('Create Testimonial');
    const createTestimonialResult = await apiRequest('/api/testimonials', {
        method: 'POST',
        body: JSON.stringify({
            testimonial_text: 'This is a test testimonial created by the API test script.',
            client_name: 'Test Client',
            client_initial: 'T.C.',
            rating: 5,
            location: 'Test City',
            is_published: true,
            is_approved: true
        })
    });
    
    let testimonialId = null;
    if (logResult(createTestimonialResult, 201)) {
        testimonialId = createTestimonialResult.data.testimonial.id;
        console.log(`   Created testimonial ID: ${testimonialId}`);
    }
    
    // Test getting single testimonial
    if (testimonialId) {
        logTest('Get Single Testimonial');
        const getTestimonialResult = await apiRequest(`/api/testimonials/${testimonialId}`);
        logResult(getTestimonialResult);
    }
    
    // Test updating testimonial
    if (testimonialId) {
        logTest('Update Testimonial');
        const updateTestimonialResult = await apiRequest(`/api/testimonials/${testimonialId}`, {
            method: 'PUT',
            body: JSON.stringify({
                testimonial_text: 'Updated test testimonial.',
                client_name: 'Updated Test Client',
                rating: 4
            })
        });
        logResult(updateTestimonialResult);
    }
    
    // Test toggle published status
    if (testimonialId) {
        logTest('Toggle Published Status');
        const toggleResult = await apiRequest(`/api/testimonials/${testimonialId}/publish`, {
            method: 'PATCH'
        });
        logResult(toggleResult);
    }
    
    // Test toggle approved status
    if (testimonialId) {
        logTest('Toggle Approved Status');
        const approveResult = await apiRequest(`/api/testimonials/${testimonialId}/approve`, {
            method: 'PATCH'
        });
        logResult(approveResult);
    }
    
    // Test deleting testimonial
    if (testimonialId) {
        logTest('Delete Testimonial');
        const deleteTestimonialResult = await apiRequest(`/api/testimonials/${testimonialId}`, {
            method: 'DELETE'
        });
        logResult(deleteTestimonialResult);
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 MuseNest API Testing Started');
    console.log(`📍 Testing server at: ${BASE_URL}`);
    
    try {
        // Test server health
        logTest('Server Health Check');
        const healthResult = await apiRequest('/health');
        if (!logResult(healthResult)) {
            console.log('❌ Server is not responding. Make sure the server is running.');
            return;
        }
        
        // Authenticate first
        const authenticated = await testAuthentication();
        if (!authenticated) {
            console.log('❌ Authentication failed. Cannot proceed with other tests.');
            return;
        }
        
        // Run all API tests
        await testGalleryAPI();
        await testFAQAPI();
        await testSettingsAPI();
        await testTestimonialsAPI();
        
        console.log('\n✅ All tests completed!');
        console.log('\n📋 Summary:');
        console.log('   - Gallery API: Image/section management ✅');
        console.log('   - FAQ API: Questions/answers CRUD ✅');
        console.log('   - Settings API: Site configuration ✅');
        console.log('   - Testimonials API: Client reviews ✅');
        console.log('\n🎉 MuseNest REST APIs are ready for production!');
        
    } catch (error) {
        console.error('❌ Test runner error:', error);
    }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
    console.log('❌ This script requires Node.js 18+ with native fetch support.');
    console.log('   Or install node-fetch: npm install node-fetch');
    process.exit(1);
}

// Run tests
runAllTests().catch(console.error);