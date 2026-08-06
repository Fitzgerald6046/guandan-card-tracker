# Groq / 百度语音代理

前端只把短音频发送到同源 `/api/stt`，所有语音服务密钥只在 VPS 服务端环境变量中保存。百度接口收到浏览器录音后，前端先转换为16k单声道WAV再识别，VPS不需要安装音频转码器。

## 环境变量

```bash
export GROQ_API_KEY='从 Groq 控制台生成的新 Key'
export GROQ_STT_MODEL='whisper-large-v3-turbo'
export STT_PORT=8787
export GROQ_PROXY_URL='http://172.18.0.1:7899' # Docker 通过宿主机 Clash 转发
export BAIDU_APP_ID='百度智能云语音应用 AppID'
export BAIDU_API_KEY='百度智能云语音 API Key'
export BAIDU_SECRET_KEY='百度智能云语音 Secret Key'
export BAIDU_DEV_PID='1537' # 普通话输入法模型
export BAIDU_CUID='guandan-tracker'
```

`GROQ_PROXY_URL` 也可以使用 `HTTPS_PROXY` 或 `HTTP_PROXY`，仅用于 Groq。百度 OAuth 和语音请求按直连百度处理，不读取 Groq 代理变量。宿主机进程通常使用 `http://127.0.0.1:7890`，Docker 容器应使用宿主机可达的转发地址（本 VPS 为 `http://172.18.0.1:7899`）。如果 VPS 出口必须经过代理，必须显式设置 Groq 代理；不要把代理地址或 API Key 写进前端代码。Groq 和百度至少配置一个即可。

前端通过以下方式选择服务：

- `/api/stt?provider=groq`
- `/api/stt?provider=baidu`

`GET /healthz` 只返回各服务是否已配置，不返回任何密钥。

## 启动

```bash
npm install --omit=dev
node groq-stt-server.mjs
```

建议用 Docker/systemd 或 supervisor 守护进程运行，并让 Nginx 将 Guandan 域名的 `/api/stt` 代理到 `127.0.0.1:8787`。`/healthz` 可用于检查代理是否已配置。

Nginx 示例：

```nginx
location = /api/stt {
    client_max_body_size 25m;
    proxy_pass http://127.0.0.1:8787;
    proxy_read_timeout 30s;
}

location = /healthz {
    proxy_pass http://127.0.0.1:8787;
}
```
