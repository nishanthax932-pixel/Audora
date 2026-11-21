# Security policy

## Supported versions
Security fixes are applied to the current default branch and active release.

## Reporting a vulnerability
Please do not publish exploitable details in a public issue. Use GitHub's
private vulnerability reporting feature for this repository if it is enabled.
Otherwise, contact the repository owner privately through their verified
GitHub profile and include:
- A concise description and affected file/endpoint
- Reproduction steps and impact
- Any suggested mitigation

Do not include real user data, API keys, session cookies, or other secrets in a
report. Please allow reasonable time for investigation and a fix before public
disclosure.

## Deployment security notes
- Never commit `.env` files or put provider API keys in browser code.
- Use HTTPS and a trusted reverse proxy; configure `AUDORA_TRUST_PROXY`
  deliberately rather than trusting arbitrary forwarded headers.
- The included in-memory rate limiter is not a shared production limiter.
- Configure authentication, durable storage, monitoring, and provider spend
  limits before exposing a multi-user production service.


## Operational metrics

The server supports an optional aggregate metrics endpoint at `GET /api/metrics`. Enable it only by setting `AUDORA_METRICS_TOKEN` to a long random secret in the server environment. Send it as a bearer token:

```http
Authorization: Bearer YOUR_METRICS_TOKEN
```

The endpoint returns process uptime, aggregate request/status counts, a bounded set of route counters and process RSS memory. It does not expose prompts, user content, API keys, IP addresses, or user identifiers. Metrics are in-memory and reset on process restart; they are not a replacement for durable telemetry, alerting, distributed tracing, or multi-instance aggregation. If the token is not configured, the endpoint returns 404. Keep the token out of browser code and public logs.
