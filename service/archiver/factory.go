package archiver

import (
	"sync"

	"github.com/QuantumNous/new-api/setting/media_archive_setting"
)

var (
	defaultOnce     sync.Once
	defaultInstance *Archiver
)

// GetDefault 返回进程级单例 Archiver。首次调用读取当前 media_archive_setting，
// 组装 httpDownloader + s3Uploader。配置在进程生命周期内视为不可变。
//
// 若 cfg.IsReady() 为 false（env 未配齐），仍返回非空 Archiver，
// 但在上传时会以 InvalidAccessKeyId / 空 endpoint 报错并被 adapter 告警。
// 建议 adapter 层在调用 GetDefault 前先 cfg.IsReady() 早退。
func GetDefault() *Archiver {
	defaultOnce.Do(func() {
		cfg := media_archive_setting.GetConfig()
		defaultInstance = New(
			newHTTPDownloader(),
			newS3Uploader(cfg),
			cfg.MaxDownloadBytes,
			cfg.PathPrefix,
		)
	})
	return defaultInstance
}

// ResetDefaultForTest 仅用于测试：强制下次 GetDefault 重新初始化。
// 生产代码不得调用。
func ResetDefaultForTest() {
	defaultOnce = sync.Once{}
	defaultInstance = nil
}
