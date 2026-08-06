export interface BaiduTranscriptionResponse {
  text: string;
  provider: 'baidu';
  model: string;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

/**
 * 百度短语音只接受 PCM/WAV/AMR/M4A，移动 Chrome 的 MediaRecorder 通常产出 WebM。
 * 在浏览器端解码并编码为 16kHz、16bit、单声道 WAV，避免 VPS 依赖 ffmpeg。
 */
export async function convertAudioToBaiduWav(audio: Blob): Promise<Blob> {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error('当前浏览器不支持百度语音所需的音频转换');
  }
  const context = new AudioContextConstructor();
  try {
    const decoded = await context.decodeAudioData(await audio.arrayBuffer());
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0 || decoded.duration > 12) {
      throw new Error('百度录音片段时长异常，请重新开启语音监听');
    }
    const targetRate = 16_000;
    const frameCount = Math.max(1, Math.round(decoded.duration * targetRate));
    const channelData = Array.from({ length: decoded.numberOfChannels }, (_, index) =>
      decoded.getChannelData(index)
    );
    const pcm = new Int16Array(frameCount);
    const ratio = decoded.sampleRate / targetRate;
    for (let index = 0; index < frameCount; index += 1) {
      const sourcePosition = index * ratio;
      const left = Math.floor(sourcePosition);
      const right = Math.min(left + 1, decoded.length - 1);
      const fraction = sourcePosition - left;
      let sample = 0;
      channelData.forEach(channel => {
        sample += channel[left] * (1 - fraction) + channel[right] * fraction;
      });
      sample /= channelData.length || 1;
      const clipped = Math.max(-1, Math.min(1, sample));
      pcm[index] = clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff;
    }

    const wav = new ArrayBuffer(44 + pcm.byteLength);
    const view = new DataView(wav);
    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcm.byteLength, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, pcm.byteLength, true);
    new Int16Array(wav, 44).set(pcm);
    return new Blob([wav], { type: 'audio/wav' });
  } finally {
    await context.close();
  }
}

export async function transcribeWithBaidu(audio: Blob): Promise<BaiduTranscriptionResponse> {
  const response = await fetch('/api/stt?provider=baidu', {
    method: 'POST',
    headers: { 'Content-Type': audio.type || 'audio/wav' },
    body: audio,
    signal: AbortSignal.timeout(22_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : '百度语音识别失败');
  }
  return payload as BaiduTranscriptionResponse;
}
