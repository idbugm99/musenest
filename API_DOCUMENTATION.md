# Phoenix4GE CRM API Documentation

## Overview

The Phoenix4GE system provides multiple API interfaces:

- **External API (v1)**: Comprehensive REST API for external applications with API key authentication
- **CRM Internal API**: Web interface backend with session authentication  
- **Public APIs**: Contact forms and chat with rate limiting

All APIs follow consistent response formats using `{ success: true, data: ... }` envelopes.

## Authentication

### Generate API Key

**POST** `/api/v1/auth/generate-key`

Generate an API key for a model account.

```json
{
  "model_slug": "your-model-slug",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "api_key": "pk_abc123...",
    "model_id": 1,
    "model_slug": "your-model-slug",
    "expires": "Never (revoke to disable)",
    "note": "Store this key securely - it will not be shown again"
  }
}
```

### Using API Key

Include the API key in the Authorization header:

```
Authorization: Bearer pk_abc123...
```

### Revoke API Key

**POST** `/api/v1/auth/revoke-key`

```json
{
  "model_slug": "your-model-slug",
  "password": "your-password"
}
```

## Clients API

### List Clients

**GET** `/api/v1/clients`

Query parameters:
- `page` (int): Page number (default: 1)
- `limit` (int): Items per page (default: 50, max: 100)
- `search` (string): Search in client identifier, email, phone
- `status` (string): Filter by status (`all`, `screened`, `unscreened`, `subscriber`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "client_identifier": "client123",
      "email_hash": "hash...",
      "phone_hash": "hash...",
      "interaction_id": 5,
      "screening_status": "approved",
      "client_category": "screened",
      "subscription_status": "active",
      "unread_count": 3,
      "conversation_count": 12,
      "created_at": "2025-09-16T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

### Get Client

**GET** `/api/v1/clients/:interactionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "client_identifier": "client123",
    "interaction_id": 5,
    "screening_status": "approved",
    "client_category": "screened",
    "subscription_status": "active",
    "notes_encrypted": "Private notes...",
    "last_contacted_at": "2025-09-16T15:30:00Z"
  }
}
```

### Create Client

**POST** `/api/v1/clients`

```json
{
  "email": "client@example.com",
  "phone": "+1234567890",
  "client_identifier": "client123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "client_id": 1,
    "interaction_id": 5,
    "created": true
  }
}
```

### Update Client

**PUT** `/api/v1/clients/:interactionId`

```json
{
  "screening_status": "approved",
  "client_category": "screened",
  "subscription_status": "active",
  "notes_encrypted": "Updated notes..."
}
```

## Conversations API

### List Conversations

**GET** `/api/v1/conversations`

Query parameters:
- `page`, `limit`: Pagination
- `status`: Filter by status (`active`, `archived`, `all`)
- `interaction_id`: Filter by client interaction

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "subject": "Initial Contact",
      "chat_status": "active",
      "client_model_interaction_id": 5,
      "client_identifier": "client123",
      "is_archived": 0,
      "unread_count": 2,
      "tags": ["screening", "appointment"],
      "message_count": 15,
      "created_at": "2025-09-16T10:00:00Z",
      "updated_at": "2025-09-16T16:30:00Z"
    }
  ]
}
```

### Get Conversation

**GET** `/api/v1/conversations/:id`

### Create Conversation

**POST** `/api/v1/conversations`

```json
{
  "interaction_id": 5,
  "subject": "New Thread",
  "message": "Initial message (optional)"
}
```

### Archive Conversation

**PUT** `/api/v1/conversations/:id/archive`

```json
{
  "archived": true
}
```

### Update Tags

**PUT** `/api/v1/conversations/:id/tags`

```json
{
  "tags": ["screening", "appointment", "follow-up"]
}
```

### Mark as Read

**PUT** `/api/v1/conversations/:id/read`

## Messages API

### List Messages

**GET** `/api/v1/messages?conversation_id=10`

Query parameters:
- `conversation_id` (required): Conversation ID
- `page`, `limit`: Pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 100,
      "sender_type": "model",
      "sender_id": 1,
      "sender_name": "your-model-slug",
      "message": "Hello, how can I help?",
      "message_type": "text",
      "timestamp": "2025-09-16T16:30:00Z",
      "file_path": null,
      "file_name": null,
      "file_size": null
    }
  ]
}
```

### Send Message

**POST** `/api/v1/messages`

```json
{
  "conversation_id": 10,
  "message": "Your message text",
  "message_type": "text"
}
```

### Get Message

**GET** `/api/v1/messages/:id`

## Screening API

### Get Screening Info

**GET** `/api/v1/screening/:interactionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "interaction_id": 5,
    "escort_client_id": 1,
    "methods": [
      {
        "id": 1,
        "method_type": "references",
        "details": "Verified with provider X",
        "status": "completed",
        "created_at": "2025-09-16T10:00:00Z"
      }
    ],
    "files": [
      {
        "id": 1,
        "file_name": "id_photo.jpg",
        "file_size": 1024000,
        "file_type": "image/jpeg",
        "uploaded_at": "2025-09-16T11:00:00Z"
      }
    ]
  }
}
```

### Add Screening Method

**POST** `/api/v1/screening/:interactionId/methods`

```json
{
  "method_type": "references",
  "details": "Contact details or notes",
  "status": "pending"
}
```

### Update Screening Method

**PUT** `/api/v1/screening/:interactionId/methods/:methodId`

```json
{
  "status": "completed",
  "details": "Updated details"
}
```

### Upload Screening File

**POST** `/api/v1/screening/:interactionId/files`

Content-Type: `multipart/form-data`

Form field: `file`

Supported types: JPEG, PNG, PDF, DOC, DOCX
Max size: 10MB

### Delete Screening File

**DELETE** `/api/v1/screening/:interactionId/files/:fileId`

## Files API

### List Conversation Files

**GET** `/api/v1/files?conversation_id=10`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "message_id": 100,
      "file_path": "/uploads/...",
      "file_name": "photo.jpg",
      "file_size": 1024000,
      "sender_name": "client123",
      "file_exists": true,
      "file_url": "/uploads/client123/photo.jpg",
      "file_extension": ".jpg",
      "is_image": true,
      "timestamp": "2025-09-16T16:30:00Z"
    }
  ]
}
```

### Get File Info

**GET** `/api/v1/files/:messageId`

### Download File

**GET** `/api/v1/files/:messageId/download`

Returns the file as a download.

### List Screening Files

**GET** `/api/v1/files/screening/:interactionId`

## Notes API

### Get Notes

**GET** `/api/v1/notes/:interactionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "interaction_id": 5,
    "client_identifier": "client123",
    "notes": "Private notes about this client...",
    "updated_at": "2025-09-16T16:30:00Z"
  }
}
```

### Update Notes

**PUT** `/api/v1/notes/:interactionId`

```json
{
  "notes": "Updated private notes..."
}
```

### Clear Notes

**DELETE** `/api/v1/notes/:interactionId`

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message"
}
```

Common HTTP status codes:
- `400`: Bad Request (missing/invalid parameters)
- `401`: Unauthorized (invalid/missing API key)
- `404`: Not Found (resource doesn't exist or no access)
- `500`: Internal Server Error

## Rate Limiting

Currently no rate limiting is implemented, but may be added in the future.

## Data Types

### Client Categories
- `unscreened`: New client, not yet verified
- `screened`: Client has passed screening
- `subscriber`: Client with active subscription

### Screening Status
- `pending`: Screening in progress
- `approved`: Screening passed
- `rejected`: Screening failed
- `pending_references`: Waiting for reference verification

### Subscription Status
- `none`: No subscription
- `active`: Active subscription
- `canceled`: Canceled subscription
- `past_due`: Payment overdue

### Message Types
- `text`: Text message
- `image`: Image attachment
- `file`: File attachment
- `system`: System message

## Integration Examples

### Node.js Example

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://phoenix4ge.com/api/v1',
  headers: {
    'Authorization': 'Bearer pk_your_api_key_here'
  }
});

// List clients
const clients = await api.get('/clients?status=screened');

// Send message
await api.post('/messages', {
  conversation_id: 10,
  message: 'Hello from external app!'
});
```

### Python Example

```python
import requests

headers = {'Authorization': 'Bearer pk_your_api_key_here'}
base_url = 'https://phoenix4ge.com/api/v1'

# Get client
response = requests.get(f'{base_url}/clients/5', headers=headers)
client = response.json()

# Update notes
requests.put(f'{base_url}/notes/5', 
  json={'notes': 'Updated from Python'}, 
  headers=headers)
```

## Support

For API support or questions, contact the development team or refer to the source code in the `/routes/api/v1/` directory.