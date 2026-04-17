package archiver

import (
	"bytes"
	"context"
	"fmt"
	"sync"

	"github.com/QuantumNous/new-api/setting/media_archive_setting"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const s3UploadPartSize = 5 * 1024 * 1024
const s3UploadConcurrency = 5

type s3Uploader struct {
	cfg      media_archive_setting.Config
	clientMu sync.Mutex
	client   *s3.Client
}

func newS3Uploader(cfg media_archive_setting.Config) *s3Uploader {
	return &s3Uploader{cfg: cfg}
}

// Upload 通过 transfermanager.Client.UploadObject 传送 blob 到 objectKey。
// 小文件退化为单次 PutObject；>=5MB 走分片并发上传。
// 使用 transfermanager（SDK v2 新推，替代已 deprecated 的 feature/s3/manager）。
func (u *s3Uploader) Upload(ctx context.Context, key string, blob Blob) (string, error) {
	client, err := u.getOrInitClient(ctx)
	if err != nil {
		return "", fmt.Errorf("init s3 client: %w", err)
	}
	tm := transfermanager.New(client, func(o *transfermanager.Options) {
		o.PartSizeBytes = s3UploadPartSize
		o.Concurrency = s3UploadConcurrency
	})
	_, err = tm.UploadObject(ctx, &transfermanager.UploadObjectInput{
		Bucket:      aws.String(u.cfg.Bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(blob.Data),
		ContentType: aws.String(blob.MimeType),
	})
	if err != nil {
		return "", err
	}
	return BuildPublicURL(u.cfg, key), nil
}

func (u *s3Uploader) getOrInitClient(ctx context.Context) (*s3.Client, error) {
	u.clientMu.Lock()
	defer u.clientMu.Unlock()
	if u.client != nil {
		return u.client, nil
	}
	awsCfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(firstNonEmpty(u.cfg.Region, "us-east-1")),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(u.cfg.AccessKey, u.cfg.SecretKey, ""),
		),
		config.WithRequestChecksumCalculation(aws.RequestChecksumCalculationWhenRequired),
		config.WithResponseChecksumValidation(aws.ResponseChecksumValidationWhenRequired),
	)
	if err != nil {
		return nil, err
	}
	u.client = s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(u.cfg.Endpoint)
		o.UsePathStyle = u.cfg.UsePathStyle
		o.APIOptions = append(o.APIOptions, stripIncompatibleArtifacts)
	})
	return u.client, nil
}
