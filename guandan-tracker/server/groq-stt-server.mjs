import { createServer } from 'node:http';
import undici from 'undici';

const { ProxyAgent } = undici;

const PORT = Number(process.env.STT_PORT || 8787);
const HOST = process.env.STT_HOST || '127.0.0.1';
const API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
const PROXY_URL = process.env.GROQ_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const BAIDU_APP_ID = process.env.BAIDU_APP_ID;
const BAIDU_API_KEY = process.env.BAIDU_API_KEY;
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY;
const BAIDU_DEV_PID = process.env.BAIDU_DEV_PID || '1537';
const BAIDU_CUID = process.env.BAIDU_CUID || `guandan-${process.env.HOSTNAME || 'stt'}`;
const MAX_BYTES = 25 * 1024 * 1024;
// 百度16kHz、16bit、单声道PCM每秒约32KB；2MB已覆盖60秒上限并留出WAV头空间。
const BAIDU_MAX_BYTES = 2 * 1024 * 1024;
const PROMPT = '掼蛋记牌。专有词：上家、下家、队友、对家、我、出牌、过牌、撤销、小王、大王、红心配、二、三、四、五、六、七、八、九、十、勾、圈、K、尖。优先把同伴位置转写为“队友”。只转写原话，不要解释。';
const BAIDU_CONFIGURED = Boolean(BAIDU_APP_ID && BAIDU_API_KEY && BAIDU_SECRET_KEY);

if (!API_KEY && !BAIDU_CONFIGURED) {
  console.error('At least one STT provider must be configured');
  process.exit(1);
}

const groqDispatcher = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;
let baiduTokenCache = { token: '', expiresAt: 0 };

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': 'same-origin',
    'Content-Length': Buffer.byteLength(payload)
  });
  response.end(payload);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error('audio_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function createGroqForm(audio, contentType) {
  const form = new FormData();
  const extension = contentType.includes('ogg')
    ? 'audio.ogg'
    : contentType.includes('mp4')
      ? 'audio.mp4'
      : contentType.includes('wav')
        ? 'audio.wav'
        : 'audio.webm';
  form.append('file', new Blob([audio], { type: contentType }), extension);
  form.append('model', MODEL);
  form.append('language', 'zh');
  form.append('prompt', PROMPT);
  form.append('temperature', '0');
  form.append('response_format', 'json');
  return form;
}

function isRetryableGroqNetworkError(error) {
  const code = error?.cause?.code || error?.code;
  return ['ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET'].includes(code);
}

async function transcribeGroq(audio, contentType) {
  if (!API_KEY) {
    const error = new Error('Groq 语音尚未配置，请检查 VPS 环境变量');
    error.status = 503;
    throw error;
  }

  let upstream;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      upstream = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}` },
        body: createGroqForm(audio, contentType),
        dispatcher: groqDispatcher,
        signal: AbortSignal.timeout(20_000)
      });
      break;
    } catch (error) {
      if (attempt === 2 || !isRetryableGroqNetworkError(error)) throw error;
      console.warn(`Groq network reset, retrying once (${error?.cause?.code || error?.code || 'network'})`);
      await wait(350);
    }
  }

  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const error = new Error(upstream.status === 429
      ? 'Groq 请求频率已达上限，请稍后重试'
      : 'Groq 语音识别失败');
    error.status = upstream.status === 429 ? 429 : 502;
    error.detail = payload?.error?.message;
    error.retryAfter = upstream.headers.get('retry-after') || undefined;
    throw error;
  }
  return {
    text: typeof payload.text === 'string' ? payload.text.trim() : '',
    provider: 'groq',
    model: MODEL
  };
}

async function getBaiduToken() {
  if (!BAIDU_CONFIGURED) {
    const error = new Error('百度语音尚未配置，请检查 VPS 环境变量');
    error.status = 503;
    throw error;
  }
  if (baiduTokenCache.token && baiduTokenCache.expiresAt > Date.now() + 60_000) {
    return baiduTokenCache.token;
  }

  const query = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: BAIDU_API_KEY,
    client_secret: BAIDU_SECRET_KEY
  });
  const upstream = await fetch(`https://aip.baidubce.com/oauth/2.0/token?${query}`, {
    signal: AbortSignal.timeout(15_000)
  });
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok || typeof payload.access_token !== 'string') {
    const error = new Error('百度语音鉴权失败，请检查 API Key 和 Secret Key');
    error.status = 502;
    error.detail = payload?.error_description || payload?.error_msg;
    throw error;
  }
  baiduTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in || 2_592_000) * 1000
  };
  return baiduTokenCache.token;
}

async function transcribeBaidu(audio, contentType) {
  const token = await getBaiduToken();
  if (!audio.length) throw new Error('音频为空');
  if (audio.length > BAIDU_MAX_BYTES) {
    const error = new Error('百度录音文件过大，请缩短口令后重试');
    error.status = 413;
    error.detail = `audio_bytes_${audio.length}`;
    throw error;
  }
  const format = contentType.includes('wav')
    ? 'wav'
    : contentType.includes('m4a') || contentType.includes('mp4')
      ? 'm4a'
      : 'pcm';

  const upstream = await fetch('https://vop.baidu.com/server_api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format,
      rate: 16000,
      channel: 1,
      cuid: BAIDU_CUID,
      token,
      dev_pid: Number(BAIDU_DEV_PID),
      speech: audio.toString('base64'),
      len: audio.length
    }),
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok || payload.err_no !== 0) {
    const error = new Error(payload.err_msg || '百度语音识别失败');
    error.status = upstream.status === 429 ? 429 : 502;
    error.detail = payload.err_no;
    throw error;
  }
  return {
    text: Array.isArray(payload.result) ? payload.result.join('').trim() : '',
    provider: 'baidu',
    model: `dev_pid_${BAIDU_DEV_PID}`
  };
}

async function transcribe(request, response) {
  let audio;
  try {
    audio = await readBody(request);
  } catch (error) {
    sendJson(response, error.message === 'audio_too_large' ? 413 : 400, {
      error: error.message === 'audio_too_large' ? '音频文件超过 25MB' : '无法读取音频'
    });
    return;
  }

  if (!audio.length) {
    sendJson(response, 400, { error: '音频为空' });
    return;
  }

  const url = new URL(request.url, 'http://127.0.0.1');
  const provider = url.searchParams.get('provider') || request.headers['x-stt-provider'] || 'groq';
  if (provider !== 'groq' && provider !== 'baidu') {
    sendJson(response, 400, { error: '不支持的语音服务' });
    return;
  }

  const contentType = request.headers['content-type'] || (provider === 'baidu' ? 'audio/wav' : 'audio/webm');
  console.info(`STT request provider=${provider} bytes=${audio.length} type=${contentType}`);

  try {
    const result = provider === 'baidu'
      ? await transcribeBaidu(audio, contentType)
      : await transcribeGroq(audio, contentType);
    console.info(`STT success provider=${provider} textLength=${result.text.length}`);
    sendJson(response, 200, result);
  } catch (error) {
    console.error(`${provider} STT request failed:`, error);
    sendJson(response, Number(error.status) || 502, {
      error: error.message || `${provider} 语音识别失败`,
      detail: error.detail,
      retryAfter: error.retryAfter
    });
  }
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url, 'http://127.0.0.1');
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': 'same-origin',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    response.end();
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname === '/healthz') {
    sendJson(response, 200, {
      ok: true,
      provider: 'multi',
      model: MODEL,
      proxyConfigured: Boolean(PROXY_URL),
      providers: {
        groq: Boolean(API_KEY),
        baidu: BAIDU_CONFIGURED
      }
    });
    return;
  }
  if (request.method === 'POST' && requestUrl.pathname === '/api/stt') {
    void transcribe(request, response);
    return;
  }
  sendJson(response, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`Groq STT proxy listening on ${HOST}:${PORT} (proxy: ${PROXY_URL ? 'configured' : 'none'})`);
});
