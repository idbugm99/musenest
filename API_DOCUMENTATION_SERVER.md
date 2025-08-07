# Enhanced AI Moderation API with Async BLIP Processing

## Overview
This API provides content moderation for images using NudeNet for NSFW detection and BLIP-2 for image description generation. The system is designed for fast response times with asynchronous processing to prevent timeouts.

## Architecture

### Quick Response Flow
1. **Immediate Analysis**: NudeNet NSFW detection (~1 second)
2. **Instant Response**: Returns batch_id and initial moderation decision
3. **Background Processing**: BLIP-2 image captioning runs asynchronously (~10-30 seconds)
4. **Webhook Notification**: Sends detailed BLIP results when processing completes
5. **Data Retrieval**: Full analysis available via `/retrieve-blip` endpoint

## API Endpoints

### 1. POST `/analyze` - Main Image Analysis

**Purpose**: Upload image for content moderation with immediate response

**Request**:
```bash
curl -X POST \
  -F "image=@your_image.jpg" \
  -F "context_type=public_gallery" \
  -F "model_id=1" \
  -F "webhook_url=https://your-webhook.com/callback" \
  http://localhost:5000/analyze
```

**Parameters**:
- `image` (required): Image file to analyze
- `context_type` (optional): `public_gallery` (default), `private_share`
- `model_id` (optional): Model identifier (default: 1)
- `webhook_url` (optional): URL to receive BLIP results when ready
- `batch_id` (optional): Custom batch identifier

**Immediate Response** (~1 second):
```json
{
  "batch_id": "batch_1753853142_6bf51660",
  "image_hash": "cffbd533bca34e72...",
  "content_moderation_id": 1,
  "moderation_status": "flagged",
  "usage_intent": "public_gallery",
  "nudity_score": 46.17,
  "flagged": true,
  "human_review_required": true,
  "final_location": "originals",
  "detected_parts": {
    "BUTTOCKS_COVERED": 46.17,
    "ARMPITS_EXPOSED": 35.03
  },
  "part_locations": {
    "BUTTOCKS_COVERED": {
      "x": 1069, "y": 1479,
      "width": 959, "height": 616,
      "confidence": 46.17
    }
  },
  "final_risk_score": 46.17,
  "risk_level": "medium",
  "combined_assessment": null,
  "processing_status": "blip_pending"
}
```

**Response Fields**:
- `batch_id`: Unique identifier for this analysis
- `processing_status`: `"blip_pending"` or `"complete"`
- `nudity_score`: Primary NSFW confidence score (0-100)
- `detected_parts`: Dictionary of detected NSFW content types
- `part_locations`: Bounding box coordinates for detected parts
- `moderation_status`: `"flagged"` or `"approved"`
- `human_review_required`: Boolean recommendation

### 2. POST/GET `/retrieve-blip` - Get Complete Analysis

**Purpose**: Retrieve full analysis including BLIP-generated image descriptions

**Request Options**:
```bash
# POST with JSON
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"batch_id":"batch_1753853142_6bf51660"}' \
  http://localhost:5000/retrieve-blip

# POST with form data
curl -X POST \
  -d "batch_id=batch_1753853142_6bf51660" \
  http://localhost:5000/retrieve-blip

# GET with query parameter
curl "http://localhost:5000/retrieve-blip?batch_id=batch_1753853142_6bf51660"
```

**Response**:
```json
{
  "batch_id": "batch_1753853142_6bf51660",
  "timestamp": "2025-07-30T05:25:52.962745",
  "expires_at": "2025-08-06T05:25:52.962758",
  "image_hash": "cffbd533bca34e72...",
  "image_description": {
    "description": "a line drawing of a man with a circle on his head",
    "description_length": 49,
    "generation_method": "blip_model",
    "model_used": "Salesforce/blip-image-captioning-base",
    "image_dimensions": "400x600",
    "tag_count": 3,
    "tags": ["man", "portrait", "photo"],
    "note": null
  },
  "combined_assessment": {
    "final_risk_score": 0.0,
    "risk_level": "minimal",
    "nudity_contribution": 0.0,
    "child_risk_contribution": 0.0,
    "description_risk": 0.0,
    "age_risk_multiplier": 1.0,
    "children_detected": false,
    "face_count": 0,
    "min_detected_age": null,
    "high_risk_combinations": 0,
    "reasoning": ["content_appears_safe"]
  }
}
```

**Error Responses**:
- `404`: Batch ID not found or expired
- `410`: Batch ID expired (automatically cleaned up)
- `400`: Missing batch_id parameter

### 3. GET `/health` - Server Status

**Purpose**: Check server health and configuration

**Response**:
```json
{
  "message": "Enhanced Minimal v3.0 with BLIP (NudeNet + Real Image Descriptions + Child Detection)",
  "status": "healthy",
  "version": "3.0_enhanced_blip2",
  "pipeline_stages": [
    "nudity_detection",
    "simulated_face_analysis",
    "blip_description",
    "child_analysis",
    "enhanced_risk_assessment"
  ],
  "blip_model": "Salesforce/blip-image-captioning-large",
  "blip_available": true,
  "device": "cpu"
}
```

### 4. GET/POST `/config/nudenet` - NudeNet Configuration

**Purpose**: Get or update NudeNet detection thresholds

**GET Request**:
```bash
curl http://localhost:5000/config/nudenet
```

**Response**:
```json
{
  "min_age_threshold": 30,
  "suspicious_age_threshold": 20,
  "nudity_threshold_public": 25,
  "nudity_threshold_private": 40,
  "nudity_threshold_default": 30
}
```

**POST Request** (Update Configuration):
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "nudity_threshold_public": 30,
    "nudity_threshold_private": 45,
    "min_age_threshold": 35
  }' \
  http://localhost:5000/config/nudenet
```

### 5. GET/POST `/config/blip` - BLIP Model Configuration

**Purpose**: Get or update BLIP-2 model generation parameters

**GET Request**:
```bash
curl http://localhost:5000/config/blip
```

**Response**:
```json
{
  "max_length": 50,
  "min_length": 5,
  "num_beams": 4,
  "temperature": 1.0,
  "top_p": 0.9,
  "repetition_penalty": 1.1,
  "cache_days": 7
}
```

**POST Request** (Update Configuration):
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "max_length": 75,
    "num_beams": 6,
    "temperature": 0.8,
    "cache_days": 14
  }' \
  http://localhost:5000/config/blip
```

### 6. POST `/restart` - Restart AI Models

**Purpose**: Restart BLIP and NudeNet models (useful after configuration changes)

**Request**:
```bash
curl -X POST http://localhost:5000/restart
```

**Response**:
```json
{
  "message": "Models restarted successfully",
  "timestamp": "2025-07-31T18:03:39.047000",
  "blip_available": true,
  "device": "cpu"
}
```

## Webhook Notifications

When `webhook_url` is provided, the server sends a POST request when BLIP processing completes:

**Webhook Payload**:
```json
{
  "batch_id": "batch_1753853142_6bf51660",
  "timestamp": "2025-07-30T05:25:53.519000",
  "status": "blip_completed",
  "image_description": {
    "description": "a line drawing of a man with a circle on his head",
    "generation_method": "blip_model",
    "model_used": "Salesforce/blip-image-captioning-base"
  },
  "combined_assessment": {
    "final_risk_score": 0.0,
    "risk_level": "minimal",
    "reasoning": ["content_appears_safe"]
  }
}
```

## Content Detection Capabilities

### NSFW Detection (NudeNet)
Detects and scores various types of explicit content:
- `FEMALE_GENITALIA_EXPOSED/COVERED`
- `MALE_GENITALIA_EXPOSED`
- `FEMALE_BREAST_EXPOSED/COVERED`
- `BUTTOCKS_EXPOSED/COVERED`
- `ANUS_EXPOSED/COVERED`
- `ARMPITS_EXPOSED`
- `FEET_EXPOSED/COVERED`
- `BELLY_EXPOSED/COVERED`
- `FACE_MALE/FEMALE`

### Image Description (BLIP-2)
- Generates natural language descriptions of image content
- Identifies objects, people, scenes, and activities
- Used for context-aware moderation decisions
- Helps detect age-inappropriate content through description analysis

### Child Content Detection
Analyzes image descriptions for child-related keywords:
- Age-related terms (`child`, `baby`, `toddler`, `teen`)
- Context indicators (`school`, `playground`, `toy`)
- Applies additional safety restrictions when detected

## Risk Assessment Logic

### Scoring System
- **Nudity Score**: Highest confidence from NudeNet detections (0-100)
- **Final Risk Score**: Combined assessment including BLIP context
- **Risk Levels**: `minimal` (0-25), `low` (25-40), `medium` (40-70), `high` (70+)

### Context-Based Thresholds
- **Public Gallery**: Strict threshold (25+) for public-facing content
- **Private Share**: Moderate threshold (40+) for private sharing
- **Default**: Standard threshold (30+)

### Moderation Decisions
- `approved`: Content passes automated review
- `flagged`: Requires human review
- `human_review_required`: Boolean flag for manual review systems

## Data Storage & Caching

### Cache Management
- **Location**: `/tmp/blip_cache/`
- **Format**: Pickle files named `{batch_id}.pkl`
- **Retention**: 7 days automatic expiration
- **Cleanup**: Expired files removed during new requests

### Image Hash
- **Purpose**: Spam prevention and duplicate detection
- **Algorithm**: SHA256 of image file content
- **Usage**: Can be used to identify repeated uploads

## Error Handling

### Common Error Responses
```json
{
  "success": false,
  "error": "No image file provided",
  "analysis_version": "3.0_enhanced_blip2_quick"
}
```

### Timeout Prevention
- NudeNet analysis completes in ~1 second
- BLIP processing moved to background threads
- Webhook notifications handle delivery of complete results
- No blocking operations in main request path

## Performance Characteristics

### Response Times
- **Initial Analysis**: ~1 second (NudeNet only)
- **BLIP Processing**: ~10-30 seconds (background)
- **Cache Retrieval**: ~100ms (immediate)

### Resource Usage
- **CPU**: High during BLIP processing
- **Memory**: ~2GB for BLIP model loading
- **Storage**: Minimal cache files (~1KB per analysis)

## Integration Examples

### Basic Upload Flow
```javascript
// 1. Upload image for immediate moderation
const formData = new FormData();
formData.append('image', imageFile);
formData.append('context_type', 'public_gallery');
formData.append('webhook_url', 'https://yoursite.com/webhook');

const response = await fetch('http://your-server:5000/analyze', {
  method: 'POST',
  body: formData
});
const result = await response.json();

// 2. Use batch_id for immediate decisions
if (result.human_review_required) {
  // Handle flagged content
  console.log(`Flagged: ${result.nudity_score}% confidence`);
  console.log('Detected parts:', result.detected_parts);
} else {
  // Content approved for immediate use
  console.log('Content approved');
}

// 3. Get detailed analysis when available
setTimeout(async () => {
  const blipData = await fetch('http://your-server:5000/retrieve-blip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch_id: result.batch_id })
  });
  const fullAnalysis = await blipData.json();
  console.log('Description:', fullAnalysis.image_description.description);
  console.log('Final risk:', fullAnalysis.combined_assessment.final_risk_score);
}, 15000); // Wait for BLIP processing
```

### Webhook Handler Example
```javascript
// Express.js webhook handler
app.post('/blip-webhook', (req, res) => {
  const { batch_id, image_description, combined_assessment } = req.body;
  
  console.log(`BLIP completed for ${batch_id}`);
  console.log(`Description: ${image_description.description}`);
  console.log(`Final risk: ${combined_assessment.final_risk_score}`);
  
  // Update your database with complete analysis
  updateAnalysis(batch_id, {
    description: image_description.description,
    risk_assessment: combined_assessment,
    children_detected: combined_assessment.children_detected,
    risk_level: combined_assessment.risk_level
  });
  
  res.json({ received: true });
});
```

### Python Client Example
```python
import requests
import json

# Upload image for analysis
def analyze_image(image_path, webhook_url=None):
    with open(image_path, 'rb') as f:
        files = {'image': f}
        data = {
            'context_type': 'public_gallery',
            'model_id': 1
        }
        if webhook_url:
            data['webhook_url'] = webhook_url
            
        response = requests.post('http://your-server:5000/analyze', 
                               files=files, data=data)
        return response.json()

# Retrieve full analysis
def get_blip_results(batch_id):
    response = requests.post('http://your-server:5000/retrieve-blip',
                           json={'batch_id': batch_id})
    return response.json()

# Example usage
result = analyze_image('test_image.jpg', 'https://yoursite.com/webhook')
print(f"Batch ID: {result['batch_id']}")
print(f"Initial status: {result['moderation_status']}")

# Wait for BLIP processing then get full results
import time
time.sleep(20)  # Wait for background processing
full_result = get_blip_results(result['batch_id'])
print(f"Description: {full_result['image_description']['description']}")
```

### Configuration Management Example
```javascript
// Get current configuration
async function getCurrentConfig() {
  const nudenetConfig = await fetch('http://your-server:5000/config/nudenet');
  const blipConfig = await fetch('http://your-server:5000/config/blip');
  
  return {
    nudenet: await nudenetConfig.json(),
    blip: await blipConfig.json()
  };
}

// Update thresholds for stricter moderation
async function setStrictMode() {
  await fetch('http://your-server:5000/config/nudenet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nudity_threshold_public: 15,  // More strict
      nudity_threshold_private: 25,
      min_age_threshold: 40
    })
  });
  
  // Restart models to apply changes
  await fetch('http://your-server:5000/restart', { method: 'POST' });
  console.log('Strict mode enabled');
}
```

### Batch Processing Example
```python
import requests
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor

async def process_image_batch(image_paths, webhook_url):
    """Process multiple images concurrently"""
    batch_ids = []
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        for image_path in image_paths:
            task = upload_image_async(session, image_path, webhook_url)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        return [r['batch_id'] for r in results if 'batch_id' in r]

async def upload_image_async(session, image_path, webhook_url):
    """Upload single image asynchronously"""
    with open(image_path, 'rb') as f:
        data = aiohttp.FormData()
        data.add_field('image', f, filename=image_path)
        data.add_field('context_type', 'public_gallery')
        if webhook_url:
            data.add_field('webhook_url', webhook_url)
        
        async with session.post('http://your-server:5000/analyze', 
                               data=data) as response:
            return await response.json()

# Usage
image_list = ['image1.jpg', 'image2.jpg', 'image3.jpg']
batch_ids = asyncio.run(process_image_batch(image_list, 'https://yoursite.com/webhook'))
print(f"Processing {len(batch_ids)} images")
```

## Security Considerations

### Input Validation
- File size limits enforced by web server
- Image format validation through OpenCV
- Malformed image handling with proper error responses

### Data Privacy
- Temporary files cleaned up after processing
- No permanent storage of uploaded images
- Cache files expire automatically after 7 days
- Image hashes for duplicate detection only

### Rate Limiting
- Consider implementing rate limiting for production use
- Background BLIP processing prevents resource exhaustion
- Thread-safe cache management

## Deployment Notes

### Dependencies
```bash
pip install torch transformers opencv-python nudenet flask requests pillow
```

### Environment Variables
- No special configuration required
- Uses CPU by default (CUDA if available)
- Loads models on startup (~6 seconds)

### Production Considerations
- Use WSGI server (gunicorn, uwsgi) instead of Flask dev server
- Configure proper logging levels
- Monitor background thread processing
- Set up webhook endpoint monitoring
- Consider load balancing for high traffic

## BLIP Processing Workflow

### Understanding the Batch ID System

The API uses a unique batch ID system to track image processing through multiple stages:

1. **Batch ID Generation**: Format is `batch_[timestamp]_[random_hex]`
   - Example: `batch_1753984721_bfa27f28`
   - Timestamp enables chronological sorting
   - Random hex prevents collisions

2. **Processing Stages**:
   ```
   Stage 1: NudeNet Detection (~1 second)
   ├── Image validation and loading
   ├── NSFW content detection
   ├── Initial risk assessment  
   └── Immediate response with batch_id
   
   Stage 2: BLIP Processing (background, ~10-30 seconds)
   ├── Image captioning with BLIP-2
   ├── Child content analysis
   ├── Enhanced risk assessment
   ├── Cache storage
   └── Webhook notification (if configured)
   ```

3. **Data Flow**:
   ```
   Client Upload → NudeNet Analysis → Immediate Response
                                   ↓
   Background Thread → BLIP Analysis → Cache Storage → Webhook
                                                     ↓
   Client Retrieval ← Cache Lookup ← /retrieve-blip endpoint
   ```

### Cache Management Details

- **Location**: `/tmp/blip_cache/{batch_id}.pkl`
- **Format**: Python pickle containing complete analysis
- **Expiration**: 7 days (configurable via BLIP config)
- **Cleanup**: Automatic during new requests and server startup
- **Thread Safety**: Concurrent access protected

## Testing Guide

### Quick API Test
```bash
# Test server health
curl http://localhost:5000/health

# Test with sample image
curl -X POST \
  -F "image=@test_image.jpg" \
  -F "context_type=public_gallery" \
  -F "webhook_url=https://webhook.site/YOUR_UNIQUE_ID" \
  http://localhost:5000/analyze
```

### Complete Workflow Test
```bash
#!/bin/bash
# test-complete-workflow.sh

SERVER="http://localhost:5000"
IMAGE="test_image.jpg"
WEBHOOK="https://webhook.site/YOUR_UNIQUE_ID"

echo "1. Testing server health..."
curl -s "$SERVER/health" | jq '.status'

echo "2. Uploading image for analysis..."
RESULT=$(curl -s -X POST \
  -F "image=@$IMAGE" \
  -F "context_type=public_gallery" \
  -F "webhook_url=$WEBHOOK" \
  "$SERVER/analyze")

BATCH_ID=$(echo "$RESULT" | jq -r '.batch_id')
echo "Batch ID: $BATCH_ID"
echo "Initial status: $(echo "$RESULT" | jq -r '.moderation_status')"

echo "3. Waiting for BLIP processing..."
sleep 20

echo "4. Retrieving complete analysis..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"batch_id\":\"$BATCH_ID\"}" \
  "$SERVER/retrieve-blip" | jq '.image_description.description'

echo "5. Check webhook.site for webhook delivery"
```

### Load Testing Example
```python
import requests
import threading
import time
from concurrent.futures import ThreadPoolExecutor

def upload_test_image(thread_id):
    """Upload test image and measure response time"""
    start_time = time.time()
    
    with open('test_image.jpg', 'rb') as f:
        files = {'image': f}
        data = {'context_type': 'public_gallery'}
        
        response = requests.post('http://localhost:5000/analyze', 
                               files=files, data=data)
        
    end_time = time.time()
    
    if response.status_code == 200:
        result = response.json()
        print(f"Thread {thread_id}: {end_time - start_time:.2f}s - {result['batch_id']}")
        return True
    else:
        print(f"Thread {thread_id}: Error {response.status_code}")
        return False

# Test with 10 concurrent uploads
with ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(upload_test_image, i) for i in range(10)]
    results = [f.result() for f in futures]
    
print(f"Success rate: {sum(results)/len(results)*100:.1f}%")
```

### Configuration Testing
```bash
# Test current configuration
echo "NudeNet Config:"
curl -s http://localhost:5000/config/nudenet | jq '.'

echo "BLIP Config:"  
curl -s http://localhost:5000/config/blip | jq '.'

# Test configuration update
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"nudity_threshold_public": 20}' \
  http://localhost:5000/config/nudenet

# Test model restart
curl -X POST http://localhost:5000/restart
```

## Troubleshooting

### Common Issues
1. **"BLIP model unavailable"**: Model failed to load, check logs for memory issues
2. **Webhook delivery failures**: Check webhook endpoint accessibility and response handling
3. **Cache not found errors**: Batch ID expired or never existed
4. **Slow BLIP processing**: Normal for CPU inference, consider GPU acceleration
5. **Address already in use**: Port 5000 occupied, check running processes with `ps aux | grep uvicorn`

### Debug Logging
The server provides detailed logging for troubleshooting:
```
🚀 Starting quick analysis for: /tmp/tmpk85bnbrr.jpg (batch_id: batch_1753853116_db85a20f)
📊 Image hash: e5341602a04c449f...
📷 Image loaded: (4000, 3000, 3)
🔞 Stage 1: Running NSFW detection...
⚡ Quick analysis complete - Status: approved
🔄 Starting BLIP processing in background...
🤖 Background BLIP processing started for batch_id: batch_1753853116_db85a20f
✅ BLIP processing complete for batch_id: batch_1753853116_db85a20f
🪝 Webhook sent successfully for batch_id: batch_1753853116_db85a20f
```

### Performance Monitoring
```bash
# Monitor server logs
tail -f /home/ubuntu/server.log

# Check system resources
htop  # or top

# Monitor cache directory
ls -la /tmp/blip_cache/

# Check webhook deliveries
curl -s "https://webhook.site/token/YOUR_TOKEN_ID/requests" | jq '.'
```

### Service Management
```bash
# Check service status
sudo systemctl status fastapi-server.service

# Restart service
sudo systemctl restart fastapi-server.service

# View service logs
journalctl -u fastapi-server.service -f

# Check if port is available
sudo netstat -tlnp | grep :5000
```