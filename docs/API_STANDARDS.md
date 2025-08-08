# API Standards

## Response Envelope
- Success: `{ success: true, data, ...extra }`
- Error: `{ success: false, error, details? }`

## Pagination
- Query: `page` (>=1), `limit` (1–100)
- Return: `{ pagination: { page, limit, total, pages } }`

## Caching
- Read-heavy lists: `Cache-Control: private, max-age=15..60`

## Path Normalization
- Middleware collapses duplicate slashes and strips trailing slash under `/api`

## Logging
- Request logger with `X-Request-Id` and start/end logs

## Error Handling
- Global error handler returns standardized JSON; stack only in development
