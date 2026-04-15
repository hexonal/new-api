# endpoints JSON 模板库

以下为常用能力模板，按需裁剪。

## 1) chat（OpenAI 兼容，单端点）

```json
{
  "chat": {
    "supported": true,
    "path": "/v1/chat/completions",
    "method": "POST",
    "provider_style": "openai-chat",
    "async": false,
    "request_format": "json",
    "sdk_method": "aiApi.chatCompletions",
    "parameters": {}
  }
}
```

## 1.1) 文本模型多端点（OpenAI Chat + Anthropic Messages）

适用场景：同一模型同时支持 `/v1/chat/completions` 与 `/v1/messages`。

```json
{
  "chat": {
    "supported": true,
    "path": "/v1/chat/completions",
    "method": "POST",
    "provider_style": "openai-chat",
    "async": false,
    "request_format": "json",
    "sdk_method": "aiApi.chatCompletions",
    "parameters": {
      "model": {
        "required": true,
        "description": "Model ID",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "messages": {
        "required": true,
        "description": "OpenAI chat messages",
        "schema": {
          "kind": "array",
          "items": {
            "kind": "object",
            "fields": {
              "role": {
                "required": true,
                "schema": {
                  "kind": "enum",
                  "value_type": "string",
                  "options": ["system", "user", "assistant", "tool"]
                }
              },
              "content": {
                "required": true,
                "schema": {
                  "kind": "scalar",
                  "value_type": "string"
                }
              }
            }
          }
        }
      }
    }
  },
  "claude_messages": {
    "supported": true,
    "path": "/v1/messages",
    "method": "POST",
    "provider_style": "anthropic",
    "async": false,
    "request_format": "json",
    "sdk_method": "aiApi.messages",
    "parameters": {
      "model": {
        "required": true,
        "description": "Model ID",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "messages": {
        "required": true,
        "description": "Anthropic messages",
        "schema": {
          "kind": "array",
          "items": {
            "kind": "object",
            "fields": {
              "role": {
                "required": true,
                "schema": {
                  "kind": "enum",
                  "value_type": "string",
                  "options": ["user", "assistant"]
                }
              },
              "content": {
                "required": true,
                "schema": {
                  "kind": "scalar",
                  "value_type": "string"
                }
              }
            }
          }
        }
      },
      "max_tokens": {
        "required": true,
        "description": "Maximum tokens for output",
        "schema": {
          "kind": "scalar",
          "value_type": "integer"
        }
      },
      "thinking": {
        "required": false,
        "description": "Reasoning config for thinking models (对象类型，字段结构由上游文档决定)",
        "schema": {
          "kind": "object",
          "fields": {}
        }
      }
    }
  },
  "openai_response": {
    "supported": true,
    "path": "/v1/responses",
    "method": "POST",
    "provider_style": "openai-response",
    "async": false,
    "request_format": "json",
    "sdk_method": "aiApi.responses",
    "parameters": {
      "model": {
        "required": true,
        "description": "Model ID",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "input": {
        "required": true,
        "description": "Responses API input (string 或 message array)",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      }
    }
  },
  "text_completion": {
    "supported": true,
    "path": "/v1/completions",
    "method": "POST",
    "provider_style": "openai-completion",
    "async": false,
    "request_format": "json",
    "sdk_method": "aiApi.completions",
    "parameters": {
      "model": {
        "required": true,
        "description": "Model ID",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "prompt": {
        "required": true,
        "description": "Text completion prompt",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "max_tokens": {
        "required": false,
        "description": "Maximum tokens for output",
        "schema": {
          "kind": "scalar",
          "value_type": "integer"
        }
      }
    }
  }
}
```

## 2) text_to_image

```json
{
  "text_to_image": {
    "supported": true,
    "path": "/v1/images/generations",
    "method": "POST",
    "provider_style": "openai-image",
    "async": false,
    "request_format": "json",
    "sdk_method": "aiApi.imageGenerations",
    "parameters": {
      "prompt": {
        "required": true,
        "description": "Image generation prompt",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "size": {
        "required": false,
        "default": "1024x1024",
        "description": "Supported size",
        "schema": {
          "kind": "enum",
          "value_type": "string",
          "options": ["1024x1024"]
        }
      }
    }
  }
}
```

## 3) image_to_image

```json
{
  "image_to_image": {
    "supported": true,
    "path": "/v1/images/edits",
    "method": "POST",
    "provider_style": "openai-image",
    "async": false,
    "request_format": "multipart",
    "sdk_method": "aiApi.imageEdits",
    "parameters": {
      "prompt": {
        "required": true,
        "description": "Image edit prompt",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "image": {
        "required": true,
        "description": "Input image file",
        "schema": {
          "kind": "file",
          "value_type": ""
        }
      }
    }
  }
}
```

## 4) text_to_video

```json
{
  "text_to_video": {
    "supported": true,
    "path": "/v1/videos",
    "method": "POST",
    "provider_style": "openai-video",
    "async": true,
    "request_format": "json",
    "sdk_method": "aiApi.videoGenerations",
    "parameters": {
      "prompt": {
        "required": true,
        "description": "Text to video prompt",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "duration": {
        "required": false,
        "default": 5,
        "description": "Duration only supports 5 or 10 seconds; default is 5",
        "schema": {
          "kind": "enum",
          "value_type": "integer",
          "options": ["5", "10"]
        }
      },
      "supportsFirstLastFrame": {
        "required": false,
        "default": false,
        "description": "Whether this model supports first-last-frame video generation",
        "schema": {
          "kind": "scalar",
          "value_type": "boolean"
        }
      },
      "supportsAudio": {
        "required": false,
        "default": false,
        "description": "Whether this model supports audio output or audio track generation",
        "schema": {
          "kind": "scalar",
          "value_type": "boolean"
        }
      }
    }
  }
}
```

## 5) image_to_video

```json
{
  "image_to_video": {
    "supported": true,
    "path": "/v1/videos",
    "method": "POST",
    "provider_style": "openai-video",
    "async": true,
    "request_format": "json",
    "sdk_method": "aiApi.videoGenerations",
    "parameters": {
      "prompt": {
        "required": true,
        "description": "Image to video prompt",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "image_url": {
        "required": true,
        "description": "Reference image URL",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "input_reference": {
        "required": true,
        "description": "Reference image URL (when provider requires dual field)",
        "schema": {
          "kind": "scalar",
          "value_type": "string"
        }
      },
      "supportsFirstLastFrame": {
        "required": false,
        "default": false,
        "description": "Whether this model supports first-last-frame video generation",
        "schema": {
          "kind": "scalar",
          "value_type": "boolean"
        }
      },
      "supportsAudio": {
        "required": false,
        "default": false,
        "description": "Whether this model supports audio output or audio track generation",
        "schema": {
          "kind": "scalar",
          "value_type": "boolean"
        }
      }
    }
  }
}
```

## 防错检查

- `kind=enum` 一定要带 `options`
- `options` 一定是字符串数组
- `default` 一定在 `options` 内
- 不要写 `endpoint` 字段
- 文本模型若支持多个端点，必须全部写入 `capabilities`
- `chat` 建议保留为主端点；扩展文本端点使用独立 key：`claude_messages`（Anthropic Messages）/ `openai_response`（Responses API）/ `text_completion`（/v1/completions）
- 扩展端点的 `provider_style` 与 `sdk_method` 必须与 SDK 的 `CAPABILITY_ENDPOINT_MAP` 对齐——禁止自造 key 或写成 `aiApi.chatCompletions`（那会导致运行时协议错配）
