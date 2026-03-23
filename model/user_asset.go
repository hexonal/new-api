package model

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type UserAssetGroup struct {
	Id              int64  `json:"id" gorm:"primaryKey"`
	CreatedAt       int64  `json:"created_at" gorm:"index"`
	UpdatedAt       int64  `json:"updated_at"`
	UserId          int    `json:"user_id" gorm:"index:idx_user_channel;not null;index:idx_uag_user_upstream,priority:1"`
	ChannelId       int    `json:"channel_id" gorm:"index:idx_user_channel;not null"`
	UpstreamGroupId string `json:"upstream_group_id" gorm:"type:varchar(191);index;index:idx_uag_user_upstream,priority:2"`
	Name            string `json:"name" gorm:"type:varchar(64);not null"`
	Description     string `json:"description" gorm:"type:varchar(300)"`
	Title           string `json:"title" gorm:"type:varchar(128)"`
	GroupType       string `json:"group_type" gorm:"type:varchar(32);default:'AIGC'"`
	ProjectName     string `json:"project_name" gorm:"type:varchar(64);default:'default'"`
	AssetCount      int    `json:"asset_count" gorm:"default:0"`
	Status          int    `json:"status" gorm:"type:int;default:1;index"`
}

func (g *UserAssetGroup) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	if g.CreatedAt == 0 {
		g.CreatedAt = now
	}
	if g.UpdatedAt == 0 {
		g.UpdatedAt = now
	}
	if g.GroupType == "" {
		g.GroupType = "AIGC"
	}
	if g.ProjectName == "" {
		g.ProjectName = "default"
	}
	if g.Status == 0 {
		g.Status = 1
	}
	return nil
}

func (g *UserAssetGroup) BeforeUpdate(tx *gorm.DB) error {
	g.UpdatedAt = common.GetTimestamp()
	return nil
}

func (g *UserAssetGroup) Create() error {
	return DB.Create(g).Error
}

func (g *UserAssetGroup) GetByID(userID int, id int64) error {
	return DB.Where("id = ? AND user_id = ? AND status = 1", id, userID).First(g).Error
}

func (g *UserAssetGroup) GetByUpstreamID(userID int, upstreamID string) error {
	return DB.Where("user_id = ? AND upstream_group_id = ? AND status = 1", userID, upstreamID).First(g).Error
}

func (g *UserAssetGroup) ListByUserID(userID int, offset int, limit int) ([]*UserAssetGroup, error) {
	groups := make([]*UserAssetGroup, 0)
	query := DB.Where("user_id = ? AND status = 1", userID).Order("id desc")
	if limit > 0 {
		query = query.Offset(offset).Limit(limit)
	}
	if err := query.Find(&groups).Error; err != nil {
		return nil, err
	}
	return groups, nil
}

func (g *UserAssetGroup) Update() error {
	return DB.Save(g).Error
}

func (g *UserAssetGroup) SoftDelete() error {
	if g.Id == 0 || g.UserId == 0 {
		return errors.New("id or user_id is empty")
	}
	return DB.Model(&UserAssetGroup{}).Where("id = ? AND user_id = ?", g.Id, g.UserId).Updates(map[string]any{
		"status":     0,
		"updated_at": common.GetTimestamp(),
	}).Error
}

type UserAsset struct {
	Id              int64          `json:"id" gorm:"primaryKey"`
	CreatedAt       int64          `json:"created_at" gorm:"index"`
	UpdatedAt       int64          `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	UserId          int            `json:"user_id" gorm:"index:idx_user_status;not null;index:idx_ua_user_upstream,priority:1"`
	GroupId         int64          `json:"group_id" gorm:"index;not null"`
	ChannelId       int            `json:"channel_id" gorm:"index;not null"`
	UpstreamAssetId string         `json:"upstream_asset_id" gorm:"type:varchar(191);index;index:idx_ua_user_upstream,priority:2"`
	FileName        string         `json:"file_name" gorm:"type:varchar(64)"`
	SourceUrl       string         `json:"source_url" gorm:"type:text"`
	AssetRef        string         `json:"asset_ref" gorm:"type:varchar(255)"`
	AssetType       string         `json:"asset_type" gorm:"type:varchar(32);index;default:'Image'"`
	Status          string         `json:"status" gorm:"type:varchar(20);index:idx_user_status;default:'Processing'"`
	ErrorCode       string         `json:"error_code,omitempty" gorm:"type:varchar(64)"`
	ErrorMessage    string         `json:"error_message,omitempty" gorm:"type:varchar(512)"`
	QuotaCost       int            `json:"quota_cost"`
}

func (a *UserAsset) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	if a.CreatedAt == 0 {
		a.CreatedAt = now
	}
	if a.UpdatedAt == 0 {
		a.UpdatedAt = now
	}
	if a.AssetType == "" {
		a.AssetType = "Image"
	}
	if a.Status == "" {
		a.Status = "Processing"
	}
	return nil
}

func (a *UserAsset) BeforeUpdate(tx *gorm.DB) error {
	a.UpdatedAt = common.GetTimestamp()
	return nil
}

func (a *UserAsset) Create() error {
	return DB.Create(a).Error
}

func (a *UserAsset) GetByID(userID int, id int64) error {
	return DB.Where("id = ? AND user_id = ?", id, userID).First(a).Error
}

func (a *UserAsset) GetByUpstreamID(userID int, upstreamID string) error {
	return DB.Where("user_id = ? AND upstream_asset_id = ?", userID, upstreamID).First(a).Error
}

func (a *UserAsset) ListByUserID(userID int, offset int, limit int) ([]*UserAsset, error) {
	assets := make([]*UserAsset, 0)
	query := DB.Where("user_id = ?", userID).Order("id desc")
	if limit > 0 {
		query = query.Offset(offset).Limit(limit)
	}
	if err := query.Find(&assets).Error; err != nil {
		return nil, err
	}
	return assets, nil
}

func (a *UserAsset) Update() error {
	return DB.Save(a).Error
}

func (a *UserAsset) SoftDelete() error {
	if a.Id == 0 || a.UserId == 0 {
		return errors.New("id or user_id is empty")
	}
	return DB.Where("id = ? AND user_id = ?", a.Id, a.UserId).Delete(&UserAsset{}).Error
}

func (a *UserAsset) HardDelete() error {
	if a.Id == 0 || a.UserId == 0 {
		return errors.New("id or user_id is empty")
	}
	return DB.Unscoped().Where("id = ? AND user_id = ?", a.Id, a.UserId).Delete(&UserAsset{}).Error
}

func CountUserAssets(userID int) (int64, error) {
	var count int64
	err := DB.Model(&UserAsset{}).Where("user_id = ?", userID).Count(&count).Error
	return count, err
}

func CountUserAssetsByGroupID(groupID int64) (int64, error) {
	var count int64
	err := DB.Model(&UserAsset{}).Where("group_id = ?", groupID).Count(&count).Error
	return count, err
}

func RefreshUserAssetGroupCount(groupID int64) error {
	cnt, err := CountUserAssetsByGroupID(groupID)
	if err != nil {
		return err
	}
	return DB.Model(&UserAssetGroup{}).Where("id = ?", groupID).Updates(map[string]any{
		"asset_count": cnt,
		"updated_at":  common.GetTimestamp(),
	}).Error
}

func UpdateUserAssetByUpstreamID(userID int, upstreamID string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = common.GetTimestamp()
	return DB.Model(&UserAsset{}).Where("user_id = ? AND upstream_asset_id = ?", userID, upstreamID).Updates(updates).Error
}

func ParseAssetDeleteID(id string) (int64, bool) {
	n, err := strconv.ParseInt(id, 10, 64)
	if err != nil || n <= 0 {
		return 0, false
	}
	return n, true
}
