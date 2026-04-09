# AI Points Integration Design

## 8. Token Naming

Token names use the format `{env}_{appId}_{userId}`.

Example:
- `dev_app123_user456`
- `prod_app123_user456`

Rationale: `new-api` routing only supports prefix matching, so putting `env` first allows callback routing by prefix to different `hexonal-app` environments.
