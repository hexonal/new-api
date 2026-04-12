---
name: skill-distribution
description: 指导将 Skill 复制到目标项目中，确保 Claude 和 Codex 都能识别。当用户说"把这个 skill 放到 xxx 项目"、"同步 skill"、"分发 skill"、"复制 skill 到"时触发。
---

# Skill 分发

从用户指令中提取两个参数：
- **源 skill 路径**：要分发的 skill 目录
- **目标项目路径**：接收 skill 的项目根目录

## 第一步：确保目标项目的 .codex/skills 是目录级 symlink

直接执行以下命令，无需判断当前状态（幂等操作）：

```bash
mkdir -p <目标项目>/.codex
rm -rf <目标项目>/.codex/skills
ln -s ../.claude/skills <目标项目>/.codex/skills
git add <目标项目>/.codex/skills
```

此 symlink 是相对路径，git 记录为 `120000 blob`，任何电脑 clone 后自动还原。

## 第二步：复制 skill

```bash
cp -r <源skill路径> <目标项目>/.claude/skills/
git add <目标项目>/.claude/skills/<skill-name>
```

## 第三步：验证

```bash
ls <目标项目>/.claude/skills/<skill-name>/SKILL.md
ls <目标项目>/.codex/skills/<skill-name>/SKILL.md
```

两个 ls 都成功则分发完成。

## 注意事项

- 同名 skill 已存在时先确认是否覆盖
- 第一步幂等，重复执行不会出错
