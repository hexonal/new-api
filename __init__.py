def register(ctx):
    from new_api_support_platform.adapter import register as _register

    return _register(ctx)

__all__ = ["register"]
