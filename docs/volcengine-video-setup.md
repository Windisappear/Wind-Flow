# 火山方舟视频接入

Wind Flow 使用火山方舟数据面 API 的异步视频任务协议。

## 配置

在根目录 `.env` 配置：

```dotenv
ARK_API_KEY=your-ark-api-key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

也可以在页面顶部齿轮的“模型服务”中添加视频模型。填写：

```text
节点类型：视频
显示名称：Seedance 2.0
真实模型 ID：doubao-seedance-2-0-260128
Base URL：https://ark.cn-beijing.volces.com/api/v3
```

## 任务协议

- 创建：`POST /contents/generations/tasks`
- 查询：`GET /contents/generations/tasks/{id}`
- 列表：`GET /contents/generations/tasks`
- 取消或删除：`DELETE /contents/generations/tasks/{id}`

使用 `Authorization: Bearer <ARK_API_KEY>` 鉴权。

视频节点传递 `ratio`、`resolution`、`duration`、`generate_audio`、`watermark` 和 `return_last_frame`。前端会轮询 `queued`、`running`、`succeeded`、`failed`、`cancelled` 和 `expired` 状态。

## 限制

视频 URL 仅在上游保留 24 小时，任务记录保留 7 天。当前本地文件选择仅作为节点附件预览；将本地媒体作为方舟参考素材需要下一阶段的对象存储上传和可公开访问 URL。
