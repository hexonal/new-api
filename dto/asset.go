package dto

import "encoding/json"

type DoubaoResponse struct {
	Code    int        `json:"code"`
	Message string     `json:"message"`
	LogID   string     `json:"log_id"`
	Data    DoubaoData `json:"data"`
}

type DoubaoData struct {
	ResponseMetadata map[string]any  `json:"ResponseMetadata"`
	Result           json.RawMessage `json:"Result"`
}

func (d *DoubaoData) UnmarshalJSON(data []byte) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	for _, key := range []string{"ResponseMetadata", "responseMetadata", "response_metadata"} {
		if v, ok := raw[key]; ok && len(v) > 0 && string(v) != "null" {
			_ = json.Unmarshal(v, &d.ResponseMetadata)
			break
		}
	}
	for _, key := range []string{"Result", "result"} {
		if v, ok := raw[key]; ok {
			d.Result = v
			break
		}
	}
	return nil
}

type DoubaoAssetResult struct {
	Id          string       `json:"Id"`
	Name        string       `json:"Name"`
	URL         string       `json:"URL"`
	GroupId     string       `json:"GroupId"`
	AssetType   string       `json:"AssetType"`
	Status      string       `json:"Status"`
	Error       *DoubaoError `json:"Error,omitempty"`
	ProjectName string       `json:"ProjectName"`
	CreateTime  string       `json:"CreateTime"`
	UpdateTime  string       `json:"UpdateTime"`
}

func (r *DoubaoAssetResult) UnmarshalJSON(data []byte) error {
	type Alias DoubaoAssetResult
	aux := struct {
		Alias
		ID            string       `json:"id"`
		GroupID       string       `json:"group_id"`
		GroupIdAlt    string       `json:"groupId"`
		AssetTypeAlt  string       `json:"asset_type"`
		ProjectAlt    string       `json:"project_name"`
		CreateTimeAlt string       `json:"create_time"`
		UpdateTimeAlt string       `json:"update_time"`
		ErrorAlt      *DoubaoError `json:"error"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = DoubaoAssetResult(aux.Alias)
	if r.Id == "" {
		r.Id = aux.ID
	}
	if r.GroupId == "" {
		if aux.GroupIdAlt != "" {
			r.GroupId = aux.GroupIdAlt
		} else {
			r.GroupId = aux.GroupID
		}
	}
	if r.AssetType == "" {
		r.AssetType = aux.AssetTypeAlt
	}
	if r.ProjectName == "" {
		r.ProjectName = aux.ProjectAlt
	}
	if r.CreateTime == "" {
		r.CreateTime = aux.CreateTimeAlt
	}
	if r.UpdateTime == "" {
		r.UpdateTime = aux.UpdateTimeAlt
	}
	if r.Error == nil {
		r.Error = aux.ErrorAlt
	}
	return nil
}

func (r *DoubaoAssetResult) NormalizedID() string {
	return r.Id
}

type DoubaoAssetGroupResult struct {
	Id          string `json:"Id"`
	Name        string `json:"Name"`
	Title       string `json:"Title"`
	Description string `json:"Description"`
	GroupType   string `json:"GroupType"`
	ProjectName string `json:"ProjectName"`
	CreateTime  string `json:"CreateTime"`
	UpdateTime  string `json:"UpdateTime"`
}

func (r *DoubaoAssetGroupResult) UnmarshalJSON(data []byte) error {
	type Alias DoubaoAssetGroupResult
	aux := struct {
		Alias
		ID            string `json:"id"`
		GroupTypeAlt  string `json:"group_type"`
		ProjectAlt    string `json:"project_name"`
		CreateTimeAlt string `json:"create_time"`
		UpdateTimeAlt string `json:"update_time"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = DoubaoAssetGroupResult(aux.Alias)
	if r.Id == "" {
		r.Id = aux.ID
	}
	if r.GroupType == "" {
		r.GroupType = aux.GroupTypeAlt
	}
	if r.ProjectName == "" {
		r.ProjectName = aux.ProjectAlt
	}
	if r.CreateTime == "" {
		r.CreateTime = aux.CreateTimeAlt
	}
	if r.UpdateTime == "" {
		r.UpdateTime = aux.UpdateTimeAlt
	}
	return nil
}

func (r *DoubaoAssetGroupResult) NormalizedID() string {
	return r.Id
}

type DoubaoError struct {
	Code    string `json:"Code"`
	Message string `json:"Message"`
}

func (e *DoubaoError) UnmarshalJSON(data []byte) error {
	type Alias DoubaoError
	aux := struct {
		Alias
		CodeAlt    string `json:"code"`
		MessageAlt string `json:"message"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*e = DoubaoError(aux.Alias)
	if e.Code == "" {
		e.Code = aux.CodeAlt
	}
	if e.Message == "" {
		e.Message = aux.MessageAlt
	}
	return nil
}

type DoubaoIDResult struct {
	Id string `json:"Id"`
}

func (r *DoubaoIDResult) UnmarshalJSON(data []byte) error {
	type Alias DoubaoIDResult
	aux := struct {
		Alias
		ID string `json:"id"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = DoubaoIDResult(aux.Alias)
	if r.Id == "" {
		r.Id = aux.ID
	}
	return nil
}

func (r *DoubaoIDResult) NormalizedID() string {
	return r.Id
}

type DoubaoListResult struct {
	Items      json.RawMessage `json:"Items"`
	TotalCount int64           `json:"TotalCount"`
	PageNumber int64           `json:"PageNumber"`
	PageSize   int64           `json:"PageSize"`
}

func (r *DoubaoListResult) UnmarshalJSON(data []byte) error {
	type Alias DoubaoListResult
	aux := struct {
		Alias
		ItemsAlt      json.RawMessage `json:"items"`
		TotalCountAlt int64           `json:"total_count"`
		PageNumberAlt int64           `json:"page_number"`
		PageSizeAlt   int64           `json:"page_size"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = DoubaoListResult(aux.Alias)
	if len(r.Items) == 0 {
		r.Items = aux.ItemsAlt
	}
	if r.TotalCount == 0 {
		r.TotalCount = aux.TotalCountAlt
	}
	if r.PageNumber == 0 {
		r.PageNumber = aux.PageNumberAlt
	}
	if r.PageSize == 0 {
		r.PageSize = aux.PageSizeAlt
	}
	return nil
}

type AssetGroupCreateRequest struct {
	Name        string `json:"name" binding:"required,max=64"`
	Description string `json:"description,omitempty" binding:"omitempty,max=300"`
	GroupType   string `json:"group_type,omitempty"`
	ProjectName string `json:"project_name,omitempty"`
}

func (r *AssetGroupCreateRequest) UnmarshalJSON(data []byte) error {
	type Alias AssetGroupCreateRequest
	aux := struct {
		Alias
		GroupTypeAlt   string `json:"groupType"`
		ProjectNameAlt string `json:"projectName"`
		NameAlt        string `json:"Name"`
		DescriptionAlt string `json:"Description"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = AssetGroupCreateRequest(aux.Alias)
	if r.Name == "" {
		r.Name = aux.NameAlt
	}
	if r.Description == "" {
		r.Description = aux.DescriptionAlt
	}
	if r.GroupType == "" {
		r.GroupType = aux.GroupTypeAlt
	}
	if r.ProjectName == "" {
		r.ProjectName = aux.ProjectNameAlt
	}
	return nil
}

type AssetGroupListFilters struct {
	Name      string   `json:"name,omitempty"`
	GroupIds  []string `json:"group_ids,omitempty"`
	GroupType string   `json:"group_type,omitempty"`
}

type AssetGroupListRequest struct {
	Filters     *AssetGroupListFilters `json:"filters,omitempty"`
	PageNumber  *int64                 `json:"page_number,omitempty"`
	PageSize    *int64                 `json:"page_size,omitempty"`
	SortBy      string                 `json:"sort_by,omitempty"`
	SortOrder   string                 `json:"sort_order,omitempty"`
	ProjectName string                 `json:"project_name,omitempty"`
}

type AssetGroupGetRequest struct {
	Id          string `json:"id" binding:"required"`
	ProjectName string `json:"project_name,omitempty"`
}

func (r *AssetGroupGetRequest) UnmarshalJSON(data []byte) error {
	type Alias AssetGroupGetRequest
	aux := struct {
		Alias
		IDAlt          string `json:"Id"`
		IDCamel        string `json:"groupId"`
		ProjectNameAlt string `json:"projectName"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = AssetGroupGetRequest(aux.Alias)
	if r.Id == "" {
		if aux.IDCamel != "" {
			r.Id = aux.IDCamel
		} else {
			r.Id = aux.IDAlt
		}
	}
	if r.ProjectName == "" {
		r.ProjectName = aux.ProjectNameAlt
	}
	return nil
}

type AssetGroupUpdateRequest struct {
	Id          string `json:"id" binding:"required"`
	Name        string `json:"name,omitempty" binding:"omitempty,max=64"`
	Description string `json:"description,omitempty" binding:"omitempty,max=300"`
	ProjectName string `json:"project_name,omitempty"`
}

func (r *AssetGroupUpdateRequest) UnmarshalJSON(data []byte) error {
	type Alias AssetGroupUpdateRequest
	aux := struct {
		Alias
		IDAlt          string `json:"Id"`
		IDCamel        string `json:"groupId"`
		ProjectNameAlt string `json:"projectName"`
		NameAlt        string `json:"Name"`
		DescriptionAlt string `json:"Description"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = AssetGroupUpdateRequest(aux.Alias)
	if r.Id == "" {
		if aux.IDCamel != "" {
			r.Id = aux.IDCamel
		} else {
			r.Id = aux.IDAlt
		}
	}
	if r.ProjectName == "" {
		r.ProjectName = aux.ProjectNameAlt
	}
	if r.Name == "" {
		r.Name = aux.NameAlt
	}
	if r.Description == "" {
		r.Description = aux.DescriptionAlt
	}
	return nil
}

type AssetCreateRequest struct {
	GroupId     string `json:"group_id" binding:"required"`
	URL         string `json:"url" binding:"required"`
	Name        string `json:"name,omitempty"`
	AssetType   string `json:"asset_type,omitempty"`
	ProjectName string `json:"project_name,omitempty"`
}

func (r *AssetCreateRequest) UnmarshalJSON(data []byte) error {
	type Alias AssetCreateRequest
	aux := struct {
		Alias
		GroupIdAlt     string `json:"groupId"`
		URLAlt         string `json:"Url"`
		NameAlt        string `json:"Name"`
		AssetTypeAlt   string `json:"assetType"`
		ProjectNameAlt string `json:"projectName"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = AssetCreateRequest(aux.Alias)
	if r.GroupId == "" {
		r.GroupId = aux.GroupIdAlt
	}
	if r.URL == "" {
		r.URL = aux.URLAlt
	}
	if r.Name == "" {
		r.Name = aux.NameAlt
	}
	if r.AssetType == "" {
		r.AssetType = aux.AssetTypeAlt
	}
	if r.ProjectName == "" {
		r.ProjectName = aux.ProjectNameAlt
	}
	return nil
}

type AssetListFilters struct {
	GroupIds  []string `json:"group_ids,omitempty"`
	GroupType string   `json:"group_type,omitempty"`
	Statuses  []string `json:"statuses,omitempty"`
	Name      string   `json:"name,omitempty"`
}

type AssetListRequest struct {
	Filters     *AssetListFilters `json:"filters,omitempty"`
	PageNumber  *int64            `json:"page_number,omitempty"`
	PageSize    *int64            `json:"page_size,omitempty"`
	SortBy      string            `json:"sort_by,omitempty"`
	SortOrder   string            `json:"sort_order,omitempty"`
	ProjectName string            `json:"project_name,omitempty"`
}

type AssetGetRequest struct {
	Id          string `json:"id" binding:"required"`
	ProjectName string `json:"project_name,omitempty"`
}

func (r *AssetGetRequest) UnmarshalJSON(data []byte) error {
	type Alias AssetGetRequest
	aux := struct {
		Alias
		IDAlt          string `json:"Id"`
		IDCamel        string `json:"assetId"`
		ProjectNameAlt string `json:"projectName"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = AssetGetRequest(aux.Alias)
	if r.Id == "" {
		if aux.IDCamel != "" {
			r.Id = aux.IDCamel
		} else {
			r.Id = aux.IDAlt
		}
	}
	if r.ProjectName == "" {
		r.ProjectName = aux.ProjectNameAlt
	}
	return nil
}

type AssetUpdateRequest struct {
	Id          string `json:"id" binding:"required"`
	Name        string `json:"name" binding:"required,max=64"`
	ProjectName string `json:"project_name,omitempty"`
}

func (r *AssetUpdateRequest) UnmarshalJSON(data []byte) error {
	type Alias AssetUpdateRequest
	aux := struct {
		Alias
		IDAlt          string `json:"Id"`
		IDCamel        string `json:"assetId"`
		NameAlt        string `json:"Name"`
		ProjectNameAlt string `json:"projectName"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = AssetUpdateRequest(aux.Alias)
	if r.Id == "" {
		if aux.IDCamel != "" {
			r.Id = aux.IDCamel
		} else {
			r.Id = aux.IDAlt
		}
	}
	if r.Name == "" {
		r.Name = aux.NameAlt
	}
	if r.ProjectName == "" {
		r.ProjectName = aux.ProjectNameAlt
	}
	return nil
}

type AssetDeleteRequest struct {
	Id string `json:"id" binding:"required"`
}

func (r *AssetDeleteRequest) UnmarshalJSON(data []byte) error {
	type Alias AssetDeleteRequest
	aux := struct {
		Alias
		IDAlt   string `json:"Id"`
		IDCamel string `json:"assetId"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = AssetDeleteRequest(aux.Alias)
	if r.Id == "" {
		if aux.IDCamel != "" {
			r.Id = aux.IDCamel
		} else {
			r.Id = aux.IDAlt
		}
	}
	return nil
}

type AssetQuotaResponse struct {
	Enabled         bool  `json:"enabled"`
	MaxCountPerUser int   `json:"max_count_per_user"`
	CurrentCount    int64 `json:"current_count"`
}
