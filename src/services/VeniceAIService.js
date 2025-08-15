const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

class VeniceAIService {
    constructor() {
        this.apiKey = process.env.VENICE_AI_KEY;
        this.baseURL = 'https://api.venice.ai/api/v1';
        
        // Comprehensive family/children terms for T&C screening
        // Use word boundaries to prevent false positives like "person" triggering "son"
        this.familyTerms = [
            'child', 'children', 'kid', 'kids', 'baby', 'infant', 'toddler', 'minor', 'minors',
            'little boy', 'little girl', 'young boy', 'young girl', 'baby brother', 'baby sister',
            'teenager', 'teen', 'adolescent', 'juvenile', 'youth', 'underage', 'schoolchild',
            'preschool', 'kindergarten', 'elementary', 'high school student', 'school age',
            'family photo', 'mother and child', 'father and child', 'parent and child',
            'daughter', 'nephew', 'niece', 'grandson', 'granddaughter',
            'young person', 'young adult', 'school uniform', 'playground', 'daycare'
        ];
        
        // Terms that need word boundary matching to prevent false positives
        this.boundaryTerms = ['son']; // "son" needs word boundaries to avoid matching "person"
    }

    /**
     * Process image with Venice.ai vision model
     * @param {string} imagePath - Path to image file
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} - Venice.ai analysis result
     */
    async processImage(imagePath, options = {}) {
        if (!this.apiKey) {
            throw new Error('Venice.ai API key not configured');
        }

        if (!fs.existsSync(imagePath)) {
            throw new Error(`Image file not found: ${imagePath}`);
        }

        try {
            logger.info(`Processing image with Venice.ai: ${path.basename(imagePath)}`);

            // Get image metadata and create properly oriented version
            const imageMetadata = await sharp(imagePath, { autoRotate: false }).metadata();
            
            // Create properly oriented image for Venice.ai
            const orientedImageBuffer = await sharp(imagePath)
                .rotate() // Auto-rotate based on EXIF orientation
                .jpeg({ quality: 95 }) // High quality for vision analysis
                .toBuffer();

            const imageBase64 = orientedImageBuffer.toString('base64');

            // Add orientation context
            let orientationContext = "";
            if (imageMetadata.orientation && imageMetadata.orientation !== 1) {
                orientationContext = " (Note: This image has been auto-rotated to correct orientation based on EXIF data - people should appear upright, not lying down.)";
            } else if (imageMetadata.height > imageMetadata.width) {
                orientationContext = " (This is a portrait/vertical image - people should be standing upright.)";
            }

            const venicePayload = {
                model: "mistral-31-24b", // Venice Medium with vision support
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Provide a comprehensive analysis of this image for content moderation and SEO optimization purposes${orientationContext}

ANALYSIS REQUIRED:
1. People (number, apparent age, gender, physical characteristics)
2. Clothing/nudity state (be explicit and clinical for moderation)
3. Activities, poses, and interactions - describe poses and any suggestive actions
4. Setting, lighting, and environment details
5. Objects and props visible
6. Overall mood or context
7. SEO Keywords - generate relevant search terms for this image
8. Alt Text - create SEO-optimized alt text for accessibility

Be detailed and clinical for moderation. Pay attention to body positioning, hand placement, facial expressions, and any suggestive poses.

Format your response exactly as:

DETAILED DESCRIPTION:
[Full clinical analysis for content moderation]

BRIEF DESCRIPTION:
[1-2 sentence summary for general display]

SEO KEYWORDS:
[Comma-separated list of 8-12 SEO keywords relevant to this image - include descriptive terms, setting, attire, poses, etc.]

ALT TEXT:
[SEO-optimized alt text under 125 characters for accessibility - include key visual elements and context]`
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 500,
                temperature: 0.1,
                venice_parameters: {
                    include_venice_system_prompt: false
                }
            };

            const veniceResponse = await axios.post(`${this.baseURL}/chat/completions`, venicePayload, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            if (!veniceResponse.data.choices || !veniceResponse.data.choices[0] || !veniceResponse.data.choices[0].message) {
                throw new Error('Invalid Venice.ai API response format');
            }

            const fullResponse = veniceResponse.data.choices[0].message.content.trim();
            
            // Parse detailed and brief descriptions
            const parsedDescriptions = this.parseDescriptions(fullResponse);
            
            // Screen for family/children content
            const childrenDetected = this.screenForChildren(parsedDescriptions.detailed);

            const result = {
                success: true,
                fullResponse: fullResponse,
                detailedDescription: parsedDescriptions.detailed,
                briefDescription: parsedDescriptions.brief,
                seoKeywords: parsedDescriptions.seoKeywords,
                altText: parsedDescriptions.altText,
                childrenDetected: childrenDetected,
                childrenTermsFound: childrenDetected.detected ? childrenDetected.termsFound : [],
                tokensUsed: veniceResponse.data.usage || {},
                model: 'Venice Medium (Vision)',
                processingTime: Date.now() - Date.now() // Will be calculated by caller
            };

            logger.info(`Venice.ai processing completed for ${path.basename(imagePath)}`);
            return result;

        } catch (error) {
            logger.error(`Venice.ai processing failed: ${error.message}`);
            
            // Return error result for handling
            return {
                success: false,
                error: error.message,
                requiresManualRetry: true,
                adminNotification: true
            };
        }
    }

    /**
     * Parse Venice.ai response into detailed descriptions, brief description, SEO keywords, and alt text
     * @param {string} fullResponse - Full Venice.ai response
     * @returns {Object} - Parsed content
     */
    parseDescriptions(fullResponse) {
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

    /**
     * Screen description for children/family content against T&C
     * @param {string} description - Description to screen
     * @returns {Object} - Screening result
     */
    screenForChildren(description) {
        const lowerDescription = description.toLowerCase();
        const foundTerms = [];

        // Check standard family terms (simple includes check)
        for (const term of this.familyTerms) {
            if (lowerDescription.includes(term.toLowerCase())) {
                foundTerms.push(term);
            }
        }
        
        // Check boundary terms (word boundary matching to prevent false positives)
        for (const term of this.boundaryTerms) {
            const regex = new RegExp(`\\b${term.toLowerCase()}\\b`, 'i');
            if (regex.test(lowerDescription)) {
                foundTerms.push(term);
            }
        }

        return {
            detected: foundTerms.length > 0,
            termsFound: foundTerms,
            severity: foundTerms.length > 3 ? 'high' : foundTerms.length > 1 ? 'medium' : 'low'
        };
    }

    /**
     * Create admin notification for Venice.ai failure
     * @param {Object} failureDetails - Details about the failure
     * @returns {Object} - Notification data
     */
    createAdminNotification(failureDetails) {
        return {
            type: 'venice_ai_failure',
            priority: 'medium',
            message: 'Venice.ai processing failed - manual retry required',
            details: failureDetails,
            actionRequired: 'Use manual Venice.ai request API to reprocess',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new VeniceAIService();