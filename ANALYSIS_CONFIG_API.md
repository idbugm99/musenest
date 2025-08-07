# Analysis Configuration API

This system allows remote management of NudeNet/BLIP detection settings per usage intent, with support for model-specific overrides.

## Features

- **Remote Configuration**: Change analysis settings from MuseNest without server access
- **Usage Intent Based**: Different rules for `public_site`, `paysite`, `store`, `private`
- **Model Overrides**: Specific models can have custom settings
- **Granular Control**: Enable/disable specific body part detection
- **Custom Scoring**: Define how detections contribute to nudity score
- **API Key Security**: Secure authentication with permission-based access
- **Audit Trail**: Track all configuration changes
- **Real-time Updates**: Changes apply immediately with caching

## Database Setup

Run the migration:
```bash
# Apply the schema
mysql -u your_user -p your_database < migrations/017_analysis_configuration_system.sql
```

This creates:
- `api_keys` - API key management
- `analysis_configurations` - Detection/scoring settings
- `analysis_config_audit` - Change tracking

## API Authentication

Use the default API key (change immediately):
```
API Key: mns_config_2025_secure_key_change_me_immediately
```

**Headers:**
```
Authorization: Bearer mns_config_2025_secure_key_change_me_immediately
# OR
X-API-Key: mns_config_2025_secure_key_change_me_immediately
```

## Configuration Structure

### Detection Config
```json
{
  "detection_config": {
    "nudenet_components": {
      "breast_detection": true,
      "genitalia_detection": true,
      "buttocks_detection": true,
      "anus_detection": false,
      "face_detection": true
    },
    "blip_components": {
      "age_estimation": true,
      "child_content_detection": true,
      "image_description": false
    }
  }
}
```

### Scoring Config
```json
{
  "scoring_config": {
    "detection_weights": {
      "BREAST_EXPOSED": 25,
      "GENITALIA": 85,
      "BUTTOCKS_EXPOSED": 20,
      "ANUS_EXPOSED": 60,
      "FACE_DETECTED": 0
    },
    "thresholds": {
      "auto_approve_under": 15,
      "auto_flag_over": 70,
      "auto_reject_over": 90
    },
    "risk_multipliers": {
      "underage_detected": 10.0,
      "child_content_blip": 5.0
    }
  }
}
```

### BLIP Config
```json
{
  "blip_config": {
    "enabled": true,
    "child_detection_keywords": ["child", "kid", "baby", "toddler", "minor"],
    "age_estimation_threshold": 18,
    "description_analysis": false,
    "webhook_delivery": true
  }
}
```

## API Endpoints

### Get Configuration
```bash
# Global configuration for usage intent
GET /api/v1/analysis/config/public_site

# Model-specific configuration
GET /api/v1/analysis/config/paysite/123
```

### Update Configuration
```bash
# Update global configuration
PUT /api/v1/analysis/config/public_site
Content-Type: application/json

{
  "detection_config": { ... },
  "scoring_config": { ... },
  "blip_config": { ... }
}
```

### Delete Configuration
```bash
# Deactivate configuration
DELETE /api/v1/analysis/config/public_site
```

### Get Audit Trail
```bash
# View configuration changes
GET /api/v1/analysis/config/public_site/audit?limit=50&offset=0
```

### Validate Configuration
```bash
# Test configuration without saving
POST /api/v1/analysis/config/validate
Content-Type: application/json

{
  "detection_config": { ... },
  "scoring_config": { ... },
  "blip_config": { ... }
}
```

## Example Usage

### Create Paysite Configuration (Ignore Nudity, Track Children)
```bash
curl -X PUT http://your-server.com/api/v1/analysis/config/paysite \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "detection_config": {
      "nudenet_components": {
        "breast_detection": false,
        "genitalia_detection": false,
        "buttocks_detection": false,
        "anus_detection": false,
        "face_detection": true
      },
      "blip_components": {
        "age_estimation": true,
        "child_content_detection": true,
        "image_description": true
      }
    },
    "scoring_config": {
      "detection_weights": {
        "BREAST_EXPOSED": 0,
        "GENITALIA": 0,
        "BUTTOCKS_EXPOSED": 0,
        "ANUS_EXPOSED": 0,
        "FACE_DETECTED": 0
      },
      "thresholds": {
        "auto_approve_under": 95,
        "auto_flag_over": 100,
        "auto_reject_over": 100
      },
      "risk_multipliers": {
        "underage_detected": 100.0,
        "child_content_blip": 100.0
      }
    },
    "blip_config": {
      "enabled": true,
      "child_detection_keywords": ["child", "kid", "baby", "minor", "young", "teen"],
      "age_estimation_threshold": 18,
      "description_analysis": true,
      "webhook_delivery": true
    }
  }'
```

### Create Public Site Configuration (Strict Nudity Control)
```bash
curl -X PUT http://your-server.com/api/v1/analysis/config/public_site \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "detection_config": {
      "nudenet_components": {
        "breast_detection": true,
        "genitalia_detection": true,
        "buttocks_detection": true,
        "anus_detection": true,
        "face_detection": true
      },
      "blip_components": {
        "age_estimation": true,
        "child_content_detection": true,
        "image_description": false
      }
    },
    "scoring_config": {
      "detection_weights": {
        "BREAST_EXPOSED": 40,
        "GENITALIA": 95,
        "BUTTOCKS_EXPOSED": 30,
        "ANUS_EXPOSED": 80,
        "FACE_DETECTED": 0
      },
      "thresholds": {
        "auto_approve_under": 10,
        "auto_flag_over": 25,
        "auto_reject_over": 60
      },
      "risk_multipliers": {
        "underage_detected": 20.0,
        "child_content_blip": 15.0
      }
    },
    "blip_config": {
      "enabled": true,
      "child_detection_keywords": ["child", "kid", "baby", "toddler", "minor", "student"],
      "age_estimation_threshold": 18,
      "description_analysis": true,
      "webhook_delivery": true
    }
  }'
```

## Security Notes

1. **Change Default API Key**: The default key should be changed immediately
2. **API Key Rotation**: Keys can be revoked and new ones created
3. **Permission System**: Keys have granular permissions (read/write/delete)
4. **IP Logging**: All API access is logged with IP addresses
5. **Audit Trail**: All configuration changes are tracked

## How It Works

1. **Upload Process**: When an image is uploaded, the system loads the appropriate configuration
2. **Configuration Hierarchy**: Model-specific configs override global configs for the same usage_intent
3. **Analysis Control**: Only enabled detection components are analyzed
4. **Scoring**: Detections are weighted according to the scoring configuration
5. **Thresholds**: Final scores determine auto-approval, flagging, or rejection
6. **Caching**: Configurations are cached for 10 minutes for performance

## Troubleshooting

### No Configuration Found
If no configuration exists, the system falls back to legacy moderation rules.

### Cache Issues
Clear configuration cache:
```bash
POST /api/v1/analysis/config/cache/clear
```

### Validation Errors
Use the validate endpoint to check configuration before saving:
```bash
POST /api/v1/analysis/config/validate
```

## Integration with MuseNest

From MuseNest, you can:
1. Store configurations locally in your database
2. Push changes to the analysis server via API
3. Track what settings are active for each usage intent
4. Override settings per model if needed

This gives you complete control over what NudeNet analyzes and how it scores results, while maintaining the flexibility to change settings without server access.