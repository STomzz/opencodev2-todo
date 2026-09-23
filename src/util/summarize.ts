/** Turns a tool name + input into a short, human-readable label/detail pair. Pure. */

const LABELS: Record<string, string> = {
  shell: "运行",
  bash: "运行",
  read: "读取",
  write: "写入",
  edit: "编辑",
  patch: "修改",
  glob: "查找文件",
  grep: "搜索",
  list: "列目录",
  webfetch: "抓取",
  websearch: "搜索网页",
  question: "询问",
  skill: "加载技能",
  subagent: "子代理",
  task: "子代理",
  execute: "执行代码",
  code: "执行代码",
  browser: "浏览器",
}

export function toolLabel(name: string): string {
  return LABELS[name] ?? name
}

function str(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function stripCd(command: string): string {
  return command.replace(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&\s*/, "")
}

function stripProtocol(url: string | undefined): string | undefined {
  return url?.replace(/^https?:\/\//, "")
}

/** Best-effort short detail for a tool call. Returns `undefined` when unknown. */
export function summarizeTool(name: string, input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined
  const obj = input as Record<string, unknown>
  switch (name) {
    case "shell":
    case "bash": {
      const command = str(obj, "command")
      return command ? stripCd(command) : undefined
    }
    case "read":
    case "write":
    case "edit":
    case "patch":
      return str(obj, "path") ?? str(obj, "filePath") ?? str(obj, "file_path")
    case "glob":
    case "grep": {
      const pattern = str(obj, "pattern")
      const where = str(obj, "path") ?? str(obj, "include")
      if (!pattern) return where
      return where ? `${pattern} · ${where}` : pattern
    }
    case "list":
      return str(obj, "path") ?? "."
    case "webfetch":
      return stripProtocol(str(obj, "url"))
    case "websearch":
      return str(obj, "query")
    case "skill":
      return str(obj, "id") ?? str(obj, "name")
    case "subagent":
    case "task": {
      const agent = str(obj, "agent") ?? str(obj, "subagent_type")
      const description = str(obj, "description")
      if (agent && description) return `${agent}: ${description}`
      return agent ?? description
    }
    case "question": {
      const questions = obj["questions"]
      if (Array.isArray(questions) && questions.length > 0) {
        const first = questions[0] as Record<string, unknown>
        return str(first, "header") ?? str(first, "question")
      }
      return undefined
    }
    case "execute":
    case "code": {
      const description = str(obj, "description")
      if (description) return description
      const code = str(obj, "code") ?? str(obj, "script")
      if (!code) return undefined
      const line = code
        .split(/\r?\n/)
        .map((value) => value.trim())
        .find((value) => value.length > 0 && !value.startsWith("//") && !value.startsWith("#"))
      return line
    }
    default: {
      for (const key of ["description", "command", "path", "query", "pattern", "url", "prompt"]) {
        const value = str(obj, key)
        if (value) return value
      }
      return undefined
    }
  }
}
