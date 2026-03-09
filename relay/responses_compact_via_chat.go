package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// responsesCompactViaChatCompletions converts a /v1/responses/compact request
// to /v1/chat/completions for channels that don't natively support the
// responses/compact endpoint (e.g. generic OpenAI-compatible providers).
func responsesCompactViaChatCompletions(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, compactReq *dto.OpenAIResponsesCompactionRequest) (*dto.Usage, *types.NewAPIError) {
	chatReq, err := compactRequestToChatCompletions(compactReq)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	err = helper.ModelMappedHelper(c, info, chatReq)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	convertedRequest, convertErr := adaptor.ConvertOpenAIRequest(c, info, chatReq)
	if convertErr != nil {
		return nil, types.NewError(convertErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

	jsonData, err := common.Marshal(convertedRequest)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return nil, newAPIErrorFromParamOverride(err)
		}
	}

	// Override relay mode and request URL for the actual upstream call
	savedRelayMode := info.RelayMode
	savedRequestURLPath := info.RequestURLPath
	defer func() {
		info.RelayMode = savedRelayMode
		info.RequestURLPath = savedRequestURLPath
	}()

	info.RelayMode = relayconstant.RelayModeChatCompletions
	info.RequestURLPath = "/v1/chat/completions"

	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, info, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	if resp == nil {
		return nil, types.NewOpenAIError(nil, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	httpResp = resp.(*http.Response)
	if httpResp.StatusCode != http.StatusOK {
		newApiErr := service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newApiErr, statusCodeMappingStr)
		return nil, newApiErr
	}

	// Read the chat completions response
	defer service.CloseResponseBodyGracefully(httpResp)

	responseBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var chatResp dto.OpenAITextResponse
	if err := common.Unmarshal(responseBody, &chatResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// Convert chat completions response to compact response format
	compactResp, usage := chatCompletionsToCompactResponse(&chatResp)

	compactRespBytes, err := common.Marshal(compactResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeConvertRequestFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, httpResp, compactRespBytes)

	return usage, nil
}

// compactRequestToChatCompletions converts an OpenAIResponsesCompactionRequest
// to a GeneralOpenAIRequest suitable for /v1/chat/completions.
func compactRequestToChatCompletions(req *dto.OpenAIResponsesCompactionRequest) (*dto.GeneralOpenAIRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}

	var messages []dto.Message

	// Convert instructions to system message
	if len(req.Instructions) > 0 {
		var instructions string
		if err := common.Unmarshal(req.Instructions, &instructions); err == nil && strings.TrimSpace(instructions) != "" {
			messages = append(messages, dto.Message{
				Role:    "system",
				Content: instructions,
			})
		}
	}

	// Parse input items
	if len(req.Input) > 0 {
		inputMsgs, err := parseResponsesInputToMessages(req.Input)
		if err != nil {
			return nil, fmt.Errorf("failed to parse input: %w", err)
		}
		messages = append(messages, inputMsgs...)
	}

	if len(messages) == 0 {
		return nil, fmt.Errorf("no messages could be derived from compact request")
	}

	return &dto.GeneralOpenAIRequest{
		Model:    req.Model,
		Messages: messages,
	}, nil
}

// parseResponsesInputToMessages converts responses API input items to chat messages.
func parseResponsesInputToMessages(input []byte) ([]dto.Message, error) {
	// Input can be a string or an array of input items
	var inputStr string
	if err := common.Unmarshal(input, &inputStr); err == nil {
		return []dto.Message{
			{Role: "user", Content: inputStr},
		}, nil
	}

	var items []map[string]any
	if err := common.Unmarshal(input, &items); err != nil {
		return nil, fmt.Errorf("input must be a string or array of items: %w", err)
	}

	var messages []dto.Message
	for _, item := range items {
		itemType, _ := item["type"].(string)
		role, _ := item["role"].(string)

		switch itemType {
		case "function_call_output":
			callID, _ := item["call_id"].(string)
			output, _ := item["output"].(string)
			messages = append(messages, dto.Message{
				Role:       "tool",
				Content:    output,
				ToolCallId: callID,
			})
		case "message", "":
			// Standard message item or simple role-based item
			if role == "" {
				continue
			}
			content := extractContentFromItem(item)
			messages = append(messages, dto.Message{
				Role:    role,
				Content: content,
			})
		default:
			// For other types (function_call, etc.), try to include as context
			if role != "" {
				content := extractContentFromItem(item)
				messages = append(messages, dto.Message{
					Role:    role,
					Content: content,
				})
			}
		}
	}
	return messages, nil
}

// extractContentFromItem extracts text content from a responses input item.
func extractContentFromItem(item map[string]any) any {
	content, exists := item["content"]
	if !exists {
		// For items with just text field
		if text, ok := item["text"].(string); ok {
			return text
		}
		return ""
	}

	// Content could be a string
	if str, ok := content.(string); ok {
		return str
	}

	// Content could be an array of content parts - convert to chat format
	if parts, ok := content.([]any); ok {
		var chatParts []map[string]any
		for _, part := range parts {
			partMap, ok := part.(map[string]any)
			if !ok {
				continue
			}
			partType, _ := partMap["type"].(string)
			switch partType {
			case "input_text":
				text, _ := partMap["text"].(string)
				chatParts = append(chatParts, map[string]any{
					"type": "text",
					"text": text,
				})
			case "output_text":
				text, _ := partMap["text"].(string)
				chatParts = append(chatParts, map[string]any{
					"type": "text",
					"text": text,
				})
			case "input_image":
				imageURL := partMap["image_url"]
				chatParts = append(chatParts, map[string]any{
					"type":      "image_url",
					"image_url": map[string]any{"url": imageURL},
				})
			default:
				// Best effort: include as text if possible
				if text, ok := partMap["text"].(string); ok {
					chatParts = append(chatParts, map[string]any{
						"type": "text",
						"text": text,
					})
				}
			}
		}
		if len(chatParts) > 0 {
			return chatParts
		}
	}

	return content
}

// chatCompletionsToCompactResponse converts a chat completions response to
// the responses/compact format.
func chatCompletionsToCompactResponse(chatResp *dto.OpenAITextResponse) (*dto.OpenAIResponsesCompactionResponse, *dto.Usage) {
	usage := &dto.Usage{}
	if chatResp != nil {
		usage.PromptTokens = chatResp.Usage.PromptTokens
		usage.CompletionTokens = chatResp.Usage.CompletionTokens
		usage.TotalTokens = chatResp.Usage.TotalTokens
		usage.InputTokens = chatResp.Usage.PromptTokens
		usage.OutputTokens = chatResp.Usage.CompletionTokens
	}

	// Build output array in responses format
	var outputItems []map[string]any
	if chatResp != nil && len(chatResp.Choices) > 0 {
		choice := chatResp.Choices[0]
		text := choice.Message.StringContent()
		if text != "" {
			outputItems = append(outputItems, map[string]any{
				"type": "message",
				"role": "assistant",
				"content": []map[string]any{
					{
						"type": "output_text",
						"text": text,
					},
				},
			})
		}
	}

	outputRaw, _ := common.Marshal(outputItems)

	compactUsage := &dto.Usage{
		InputTokens:      usage.PromptTokens,
		OutputTokens:     usage.CompletionTokens,
		TotalTokens:      usage.TotalTokens,
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
	}

	id := chatResp.Id
	if id == "" {
		id = fmt.Sprintf("resp_compact_%d", time.Now().UnixNano())
	}

	var createdAt int
	switch v := chatResp.Created.(type) {
	case float64:
		createdAt = int(v)
	case int:
		createdAt = v
	case int64:
		createdAt = int(v)
	default:
		createdAt = int(time.Now().Unix())
	}

	return &dto.OpenAIResponsesCompactionResponse{
		ID:        id,
		Object:    "response",
		CreatedAt: createdAt,
		Output:    outputRaw,
		Usage:     compactUsage,
	}, usage
}

// isNativeResponsesCompactSupported returns true if the channel natively
// supports the /v1/responses/compact endpoint.
func isNativeResponsesCompactSupported(info *relaycommon.RelayInfo) bool {
	baseURL := strings.ToLower(info.ChannelBaseUrl)
	// Actual OpenAI API
	if strings.Contains(baseURL, "openai.com") {
		return true
	}
	// Azure OpenAI (handled separately in adaptor but just in case)
	if strings.Contains(baseURL, "azure.com") || strings.Contains(baseURL, "azure.net") {
		return true
	}
	return false
}
