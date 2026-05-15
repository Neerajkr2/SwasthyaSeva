# backend/middleware/rate_limit.py
"""
Simple in-memory rate limiter middleware.
Uses a sliding window counter per client IP.
For production, replace with Redis-backed rate limiting (slowapi + redis).
"""
import time, logging
from collections import defaultdict, deque
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ── Rate limit rules ──────────────────────────────────────────────────────────
RULES: dict[str, tuple[int, int]] = {
    # path_prefix: (max_requests, window_seconds)
    "/auth":   (20, 60),    # 20 auth attempts per minute
    "/ml":     (30, 60),    # 30 ML requests per minute (heavier endpoints)
    "/chat":   (60, 60),    # 60 chat messages per minute
    "/users":  (100, 60),   # 100 user API calls per minute
    "default": (200, 60),   # 200 general requests per minute
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # {client_ip: {route_prefix: deque of timestamps}}
        self._windows: dict[str, dict[str, deque]] = defaultdict(lambda: defaultdict(deque))

    def _get_client_ip(self, request: Request) -> str:
        """Extract real client IP, accounting for reverse proxies."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _get_rule(self, path: str) -> tuple[str, int, int]:
        """Return (prefix, max_requests, window_seconds) for the given path."""
        for prefix, (limit, window) in RULES.items():
            if prefix != "default" and path.startswith(prefix):
                return prefix, limit, window
        return "default", *RULES["default"]

    async def dispatch(self, request: Request, call_next) -> Response:
        client_ip = self._get_client_ip(request)
        path      = request.url.path
        prefix, limit, window = self._get_rule(path)

        now      = time.time()
        bucket   = self._windows[client_ip][prefix]

        # Evict timestamps outside the sliding window
        while bucket and bucket[0] < now - window:
            bucket.popleft()

        if len(bucket) >= limit:
            logger.warning(f"Rate limit exceeded: {client_ip} → {path}")
            return Response(
                content='{"detail":"Too many requests. Please slow down."}',
                status_code=429,
                headers={
                    "Content-Type":     "application/json",
                    "Retry-After":      str(window),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Reset": str(int(now + window)),
                },
            )

        bucket.append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"]     = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - len(bucket)))
        return response
