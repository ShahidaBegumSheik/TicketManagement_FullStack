import json
import time
from typing import Any

try:
    import redis
except Exception:
    redis = None

from app.core.config import settings

_memory_cache: dict[str, tuple[float, str]] = {}

def _get_redis_client():
    if not settings.redis_url or redis is None:
        return None
    
    try:
        return redis.Redis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        return None
    
def cache_get(key: str) -> Any | None:
    client = _get_redis_client()
    if client:
        try:
            value=client.get(key)
            return json.loads(value) if value else None
        except Exception:
            pass

    item = _memory_cache.get(key)
    if not item:
        return None
    
    expires_at, value = item
    if time.time() > expires_at:
        _memory_cache.pop(key, None)
        return None

    return json.loads(value)

def cache_set(key: str, value: Any, ttl: int | None = None) -> None:
    ttl = ttl or settings.cache_ttl_seconds
    serialized = json.dumps(value, default=str)

    client = _get_redis_client()
    if client:
        try:
            client.setex(key, ttl, serialized)
            return
        except Exception:
            pass

    _memory_cache[key] = (time.time() + ttl, serialized)

def cache_delete(key: str) -> None:
    client = _get_redis_client()
    if client:
        try:
            client.delete(key)
        except Exception:
            pass
    _memory_cache.pop(key, None)

def cache_delete_prefix(prefix: str) -> None:
    client = _get_redis_client()
    if client:
        try:
            for key in client.scan_iter(f"{prefix}*"):
                client.delete(key)
        except Exception:
            pass

    to_delete = [k for k in _memory_cache if k.startswith(prefix)]
    for key in to_delete:
        _memory_cache.pop(key, None)
    

