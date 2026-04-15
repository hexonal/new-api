package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
)

func TestToGenerationRecordDTOIncludesTokenAndRawBodies(t *testing.T) {
	requestBody := `{"model":"doubao-seedream-4-5-251128","prompt":"cat"}`
	responseBody := `{"data":[{"url":"https://example.com/cat.png","revised_prompt":"cat"}],"created":1776260350}`
	record := &model.GenerationRecord{
		RecordID:     28,
		TokenName:    "dev_vid-craft_30",
		Kind:         model.GenerationKindImage,
		Status:       model.GenerationStatusSuccess,
		Model:        "doubao-seedream-4-5-251128",
		RequestBody:  requestBody,
		ResponseBody: responseBody,
		SubmitTime:   1776260350,
	}

	result := toGenerationRecordDTO(record)

	assert.Equal(t, "dev_vid-craft_30", result.Token)
	assert.JSONEq(t, requestBody, result.RequestBody)
	assert.JSONEq(t, responseBody, result.ResponseBody)
}
