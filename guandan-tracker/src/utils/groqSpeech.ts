export interface GroqTranscriptionResponse {
  text: string;
  provider: 'groq';
  model: string;
}

export async function transcribeWithGroq(audio: Blob): Promise<GroqTranscriptionResponse> {
  const response = await fetch('/api/stt', {
    method: 'POST',
    headers: { 'Content-Type': audio.type || 'audio/webm' },
    body: audio,
    signal: AbortSignal.timeout(22_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Groq 语音识别失败');
  }
  return payload as GroqTranscriptionResponse;
}
