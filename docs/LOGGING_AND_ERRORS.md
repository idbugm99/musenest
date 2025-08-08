# Logging and Error Handling

## Request Logging
- Middleware: `middleware/requestLogger.js`
- Assigns `X-Request-Id`, logs start/end with method, URL, status, duration
- Skips static/health routes; optional body logging via `LOG_REQUEST_BODY=true`

## Response Envelope
- Middleware: `middleware/responseEnvelope.js`
- `res.success(data, extra)` → `{ success: true, ...extra, data }`
- `res.fail(status, error, details?)` → `{ success: false, error, details? }`

## Global Error Handler
- Standardized JSON; includes stack in development only

## Examples
```js
// success
return res.success({ items, pagination }, { message: 'OK' });
// fail
return res.fail(400, 'Missing required fields');
```

## Conventions
- Lists accept `page` and `limit` (clamped)
- Short `Cache-Control` (15–60s) for read-heavy endpoints
