package service

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/model"
)

func pollAssetStatus(client *AssetProxyClient, assetID int64, upstreamID string) {
	backoffs := []time.Duration{
		2 * time.Second,
		2 * time.Second,
		5 * time.Second,
		5 * time.Second,
		10 * time.Second,
		10 * time.Second,
		30 * time.Second,
	}

	for _, wait := range backoffs {
		time.Sleep(wait)

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		asset, err := client.GetAsset(ctx, upstreamID, "")
		cancel()
		if err != nil {
			continue
		}

		switch asset.Status {
		case "Active":
			_ = model.DB.Model(&model.UserAsset{}).Where("id = ?", assetID).Updates(map[string]any{
				"status":        "Active",
				"asset_ref":     fmt.Sprintf("asset://%s", upstreamID),
				"error_code":    "",
				"error_message": "",
				"updated_at":    time.Now().Unix(),
			}).Error
			return
		case "Failed":
			errorCode := ""
			errorMessage := ""
			if asset.Error != nil {
				errorCode = asset.Error.Code
				errorMessage = asset.Error.Message
			}
			// v3 计费约定：素材异步处理失败不退款（上游已消耗处理资源）。
			model.DB.Logger.Info(context.Background(),
				"asset polling failed without refund: asset_id=%d upstream_id=%s error_code=%s error_message=%s",
				assetID, upstreamID, errorCode, errorMessage,
			)
			_ = model.DB.Model(&model.UserAsset{}).Where("id = ?", assetID).Updates(map[string]any{
				"status":        "Failed",
				"error_code":    errorCode,
				"error_message": errorMessage,
				"updated_at":    time.Now().Unix(),
			}).Error
			return
		}
	}
}
