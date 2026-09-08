function ingestBase(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://your-host.example.com';
}

export interface ConnectionSnippets {
  curlTelemetry: string;
  curlAnnounce: string;
}

export function buildConnectionSnippets(deviceId: number, apiKey: string): ConnectionSnippets {
  const base = ingestBase();
  return {
    curlTelemetry: `curl -X POST ${base}/api/v1/ingest/telemetry \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{"device_id":${deviceId},"readings":[{"metric":"temperature","value":22.5,"type":"number"}]}'`,
    curlAnnounce: `curl -X POST ${base}/api/v1/ingest/announce \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{"device_id":${deviceId},"schema_version":1,"capabilities":[{"name":"temperature","type":"number","role":"sensor","unit":"°C","min":0,"max":50}]}'`,
  };
}
