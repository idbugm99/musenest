#!/usr/bin/env node

/**
 * Fix Venice SEO Keywords Parsing
 * 
 * This script re-parses existing Venice descriptions to extract SEO keywords
 * that weren't properly extracted due to parsing issues.
 */

const db = require('../config/database');

/**
 * Parse Venice.ai response to extract SEO data
 */
function parseVeniceDescription(fullResponse) {
    let detailedDescription = fullResponse;
    let briefDescription = "";
    let seoKeywords = [];
    let altText = "";
    
    // Parse DETAILED DESCRIPTION
    const detailedMatch = fullResponse.match(/DETAILED DESCRIPTION:\s*([\s\S]*?)\s*(?:BRIEF DESCRIPTION:|SEO KEYWORDS:|ALT TEXT:|$)/);
    if (detailedMatch) {
        detailedDescription = detailedMatch[1].trim();
    }
    
    // Parse BRIEF DESCRIPTION
    const briefMatch = fullResponse.match(/BRIEF DESCRIPTION:\s*([\s\S]*?)\s*(?:SEO KEYWORDS:|ALT TEXT:|$)/);
    if (briefMatch) {
        briefDescription = briefMatch[1].trim();
    }
    
    // Parse SEO KEYWORDS - try multiple patterns
    let keywordsMatch = fullResponse.match(/SEO KEYWORDS:\s*([\s\S]*?)\s*(?:ALT TEXT:|$)/);
    
    // Fallback: look for "SEO Keywords:" pattern in detailed description  
    if (!keywordsMatch) {
        keywordsMatch = fullResponse.match(/SEO Keywords:\s*([^\n\r]*)/i);
    }
    
    // Additional fallback: look for "7. SEO Keywords:" pattern
    if (!keywordsMatch) {
        keywordsMatch = fullResponse.match(/7\.\s*SEO Keywords:\s*([^\n\r]*)/i);
    }
    
    if (keywordsMatch) {
        const keywordsText = keywordsMatch[1].trim();
        seoKeywords = keywordsText
            .split(',')
            .map(keyword => keyword.trim())
            .filter(keyword => keyword.length > 0 && keyword !== '');
    }
    
    // Parse ALT TEXT - try multiple patterns
    let altMatch = fullResponse.match(/ALT TEXT:\s*([\s\S]*?)$/);
    
    // Fallback: look for "Alt Text:" pattern in detailed description
    if (!altMatch) {
        altMatch = fullResponse.match(/Alt Text:\s*([^\n\r]*)/i);
    }
    
    // Additional fallback: look for "8. Alt Text:" pattern
    if (!altMatch) {
        altMatch = fullResponse.match(/8\.\s*Alt Text:\s*([^\n\r]*)/i);
    }
    
    if (altMatch) {
        altText = altMatch[1].trim();
        // Ensure alt text is under 125 characters for SEO
        if (altText.length > 125) {
            altText = altText.substring(0, 122) + '...';
        }
    }
    
    // Fallbacks for missing sections
    if (!briefDescription && detailedDescription) {
        const sentences = detailedDescription.match(/[^\.!?]+[\.!?]+/g);
        if (sentences && sentences.length > 0) {
            briefDescription = sentences[0].trim();
        }
    }
    
    // Generate fallback alt text if missing
    if (!altText && briefDescription) {
        altText = briefDescription.length > 125 ? 
            briefDescription.substring(0, 122) + '...' : 
            briefDescription;
    }

    return {
        detailed: detailedDescription,
        brief: briefDescription,
        seoKeywords: seoKeywords,
        altText: altText
    };
}

async function fixVeniceKeywords() {
    console.log('🔧 Fixing Venice SEO keywords parsing...');
    
    try {
        // Get all content_moderation entries with Venice descriptions but missing keywords
        const query = `
            SELECT id, venice_description 
            FROM content_moderation 
            WHERE venice_description IS NOT NULL 
            AND (venice_seo_keywords IS NULL OR venice_seo_keywords = '[]' OR venice_seo_keywords = 'null')
            ORDER BY created_at DESC
        `;
        
        const entries = await db.query(query);
        console.log(`📋 Found ${entries.length} entries to fix`);
        
        if (entries.length === 0) {
            console.log('✅ No entries need keyword fixing');
            return;
        }
        
        let fixed = 0;
        let errors = 0;
        
        for (const entry of entries) {
            try {
                console.log(`🔍 Processing entry ${entry.id}...`);
                
                // Parse Venice descriptions directly using the same logic
                const parsed = parseVeniceDescription(entry.venice_description);
                
                console.log(`   Keywords found: ${parsed.seoKeywords.length}`);
                console.log(`   Alt text: ${parsed.altText ? 'Generated' : 'Missing'}`);
                
                if (parsed.seoKeywords.length > 0 || parsed.altText) {
                    // Update the database with properly parsed data
                    const updateQuery = `
                        UPDATE content_moderation 
                        SET 
                            venice_seo_keywords = ?,
                            venice_alt_text = COALESCE(venice_alt_text, ?),
                            venice_brief_description = COALESCE(venice_brief_description, ?)
                        WHERE id = ?
                    `;
                    
                    await db.query(updateQuery, [
                        JSON.stringify(parsed.seoKeywords),
                        parsed.altText,
                        parsed.brief,
                        entry.id
                    ]);
                    
                    console.log(`   ✅ Updated entry ${entry.id} with ${parsed.seoKeywords.length} keywords`);
                    fixed++;
                } else {
                    console.log(`   ⚠️  No keywords extracted for entry ${entry.id}`);
                }
                
            } catch (error) {
                errors++;
                console.error(`   ❌ Error processing entry ${entry.id}:`, error.message);
            }
        }
        
        console.log('\n📊 RESULTS:');
        console.log(`✅ Fixed: ${fixed}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`📋 Total: ${entries.length}`);
        
        if (fixed > 0) {
            console.log('\n🎉 Venice keyword parsing has been fixed!');
            console.log('Future uploads will automatically extract keywords properly.');
        }
        
    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    } finally {
        if (db && typeof db.end === 'function') {
            await db.end();
        } else if (db && typeof db.close === 'function') {
            await db.close();
        }
        console.log('📝 Database connection closed');
    }
}

// Run if called directly
if (require.main === module) {
    fixVeniceKeywords().catch(error => {
        console.error('Script error:', error);
        process.exit(1);
    });
}

module.exports = { fixVeniceKeywords };