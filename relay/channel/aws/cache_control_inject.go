package aws

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

var (
	awsClaudeAutoCacheBreakpointEnabled = common.GetEnvOrDefaultBool("AWS_CLAUDE_AUTO_CACHE_BREAKPOINT_ENABLED", true)
	defaultEphemeralCacheControl        = json.RawMessage(`{"type":"ephemeral"}`)
)

type cacheTarget struct {
	targetType string
	msgIndex   int
	blockIndex int
	textLength int
}

func cloneRawMessage(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return nil
	}
	out := make([]byte, len(raw))
	copy(out, raw)
	return out
}

func maybeInjectAwsClaudeCacheControl(req *dto.ClaudeRequest) bool {
	if req == nil || !awsClaudeAutoCacheBreakpointEnabled {
		return false
	}
	if !strings.Contains(strings.ToLower(req.Model), "claude") {
		return false
	}
	if hasClaudeCacheControlBreakpoint(req) {
		return false
	}
	target, ok := selectBestCacheTarget(req)
	if !ok {
		return false
	}
	return applyCacheControlToTarget(req, target, cloneRawMessage(defaultEphemeralCacheControl))
}

func hasClaudeCacheControlBreakpoint(req *dto.ClaudeRequest) bool {
	if req == nil {
		return false
	}
	if len(req.CacheControl) > 0 {
		return true
	}
	if !req.IsStringSystem() {
		for _, block := range req.ParseSystem() {
			if len(block.CacheControl) > 0 {
				return true
			}
		}
	}
	for _, message := range req.Messages {
		blocks, err := message.ParseContent()
		if err != nil {
			continue
		}
		for _, block := range blocks {
			if len(block.CacheControl) > 0 {
				return true
			}
		}
	}
	return false
}

func selectBestCacheTarget(req *dto.ClaudeRequest) (cacheTarget, bool) {
	best := cacheTarget{textLength: 0}
	found := false

	updateBest := func(candidate cacheTarget) {
		if !found || candidate.textLength > best.textLength ||
			(candidate.textLength == best.textLength && strings.HasPrefix(candidate.targetType, "system")) {
			best = candidate
			found = true
		}
	}

	if req.IsStringSystem() {
		sysText := strings.TrimSpace(req.GetStringSystem())
		if sysText != "" {
			updateBest(cacheTarget{
				targetType: "system_string",
				textLength: len(sysText),
			})
		}
	} else {
		systemBlocks := req.ParseSystem()
		for idx, block := range systemBlocks {
			if block.Type != "text" {
				continue
			}
			text := strings.TrimSpace(block.GetText())
			if text == "" {
				continue
			}
			updateBest(cacheTarget{
				targetType: "system_block",
				blockIndex: idx,
				textLength: len(text),
			})
		}
	}

	for msgIdx, msg := range req.Messages {
		if msg.IsStringContent() {
			text := strings.TrimSpace(msg.GetStringContent())
			if text == "" {
				continue
			}
			updateBest(cacheTarget{
				targetType: "message_string",
				msgIndex:   msgIdx,
				textLength: len(text),
			})
			continue
		}
		blocks, err := msg.ParseContent()
		if err != nil {
			continue
		}
		for blockIdx, block := range blocks {
			if block.Type != "text" {
				continue
			}
			text := strings.TrimSpace(block.GetText())
			if text == "" {
				continue
			}
			updateBest(cacheTarget{
				targetType: "message_block",
				msgIndex:   msgIdx,
				blockIndex: blockIdx,
				textLength: len(text),
			})
		}
	}

	return best, found
}

func applyCacheControlToTarget(req *dto.ClaudeRequest, target cacheTarget, cacheControl json.RawMessage) bool {
	switch target.targetType {
	case "system_string":
		sysText := strings.TrimSpace(req.GetStringSystem())
		if sysText == "" {
			return false
		}
		req.System = []dto.ClaudeMediaMessage{
			{
				Type:         "text",
				Text:         common.GetPointer(sysText),
				CacheControl: cacheControl,
			},
		}
		return true
	case "system_block":
		systemBlocks := req.ParseSystem()
		if target.blockIndex < 0 || target.blockIndex >= len(systemBlocks) {
			return false
		}
		systemBlocks[target.blockIndex].CacheControl = cacheControl
		req.System = systemBlocks
		return true
	case "message_string":
		if target.msgIndex < 0 || target.msgIndex >= len(req.Messages) {
			return false
		}
		msg := req.Messages[target.msgIndex]
		msgText := strings.TrimSpace(msg.GetStringContent())
		if msgText == "" {
			return false
		}
		msg.Content = []dto.ClaudeMediaMessage{
			{
				Type:         "text",
				Text:         common.GetPointer(msgText),
				CacheControl: cacheControl,
			},
		}
		req.Messages[target.msgIndex] = msg
		return true
	case "message_block":
		if target.msgIndex < 0 || target.msgIndex >= len(req.Messages) {
			return false
		}
		msg := req.Messages[target.msgIndex]
		blocks, err := msg.ParseContent()
		if err != nil || target.blockIndex < 0 || target.blockIndex >= len(blocks) {
			return false
		}
		blocks[target.blockIndex].CacheControl = cacheControl
		msg.Content = blocks
		req.Messages[target.msgIndex] = msg
		return true
	default:
		return false
	}
}

