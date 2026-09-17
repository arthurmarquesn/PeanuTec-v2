from fastapi.routing import APIRouter


LEGACY_AUTH_ROUTE_PATHS = frozenset(
    {
        "/auth/register",
        "/auth/login",
        "/auth/me",
    }
)


def disable_legacy_auth_routes() -> None:
    """Prevents the retired authentication endpoints from being registered."""
    if getattr(APIRouter, "_peanutec_auth_routes_disabled", False):
        return

    original_add_api_route = APIRouter.add_api_route

    def add_api_route_without_legacy_auth(self, path, endpoint, *args, **kwargs):
        if path in LEGACY_AUTH_ROUTE_PATHS:
            return endpoint
        return original_add_api_route(self, path, endpoint, *args, **kwargs)

    APIRouter.add_api_route = add_api_route_without_legacy_auth
    APIRouter._peanutec_auth_routes_disabled = True
