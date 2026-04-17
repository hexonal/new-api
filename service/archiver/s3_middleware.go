package archiver

import (
	"context"

	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// stripIncompatibleArtifacts 移除 AWS SDK v2 在请求中默认加入的、
// 但被 Caddy 反代 / RustFS / 老版 MinIO 在转发时剥离的元素。
// 任一不一致都会让后端重算的 canonical request 与 SDK 签的不同，
// 直接返回 SignatureDoesNotMatch 403。
//
// 必须插在 "Signing" middleware 之前；SDK retry middleware 会在每次尝试前
// 重新注入 Amz-Sdk-Request，所以必须精确定位插入位置。
func stripIncompatibleArtifacts(stack *middleware.Stack) error {
	return stack.Finalize.Insert(middleware.FinalizeMiddlewareFunc(
		"StripIncompatibleArtifacts",
		func(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (middleware.FinalizeOutput, middleware.Metadata, error) {
			if req, ok := in.Request.(*smithyhttp.Request); ok {
				q := req.URL.Query()
				q.Del("x-id")
				req.URL.RawQuery = q.Encode()
				req.Header.Del("Amz-Sdk-Invocation-Id")
				req.Header.Del("Amz-Sdk-Request")
				req.Header.Del("Accept-Encoding")
			}
			return next.HandleFinalize(ctx, in)
		},
	), "Signing", middleware.Before)
}
