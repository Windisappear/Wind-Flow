# Provider 配置

## DeepSeek

不要把 API Key 写进源码或提交到 Git。启动 API 的 PowerShell 窗口中设置：

```powershell
$env:DEEPSEEK_API_KEY = '<your-key>'
$env:DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
pnpm --filter @canvas/api dev
```

检查配置状态：

```powershell
Invoke-RestMethod http://localhost:3000/api/providers/deepseek
```

真正发送一次对话请求（会消耗额度）：

```powershell
$body = @{ model='deepseek-chat'; messages=@(@{ role='user'; content='你好' }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/providers/deepseek/chat -ContentType 'application/json' -Body $body
```

## 中转站图像 API

当前已按你提供的多元探索即梦文档接入 `POST /v1/images/generations` 格式。文档中的主要字段是 `model`、`prompt`、`n`、`size`、`image[]`、`ratio` 和 `resolution`。

配置：

```powershell
$env:JIMENG_API_KEY = '<relay-key>'
$env:JIMENG_BASE_URL = '<relay-base-url-without-trailing-slash>'
$env:JIMENG_MODEL = 'jimeng-4.5'
```

检查状态：

```powershell
Invoke-RestMethod http://localhost:3000/api/providers/jimeng
```

测试请求（会消耗额度）：

```powershell
$body = @{ model='jimeng-4.5'; prompt='一座清晨的未来城市'; n=1; size='1024*1024'; ratio='1:1'; resolution='2k' } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/providers/jimeng/images -ContentType 'application/json' -Body $body
```

中转站需要提供以下信息：

- API Base URL，例如 `https://proxy.example.com/v1`。
- API Key。
- 模型 ID，例如 `image-2`、`seedream-4.0`。
- 协议类型：OpenAI Images、OpenAI-compatible Chat 图片返回、或自定义异步任务。
- 结果形式：URL、Base64、任务 ID 轮询。

推荐优先选择 OpenAI Images 兼容协议。后端适配器需要实现：

```text
validateCredential
submitImage
queryTask
cancelTask
downloadResult
normalizeError
```

配置示例（占位，不要提交真实 Key）：

```env
IMAGE_RELAY_BASE_URL=https://proxy.example.com/v1
IMAGE_RELAY_API_KEY=
IMAGE_RELAY_MODEL=image-2
IMAGE_RELAY_PROTOCOL=openai-images
```

如果中转站是异步任务接口，还需要提供提交、查询和取消接口的路径，以及响应中的任务 ID 和结果 URL 字段。不要把中转站账号 Cookie、浏览器 Token 或私有登录态放进项目配置。
