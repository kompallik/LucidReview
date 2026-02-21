import { fetch } from 'undici';
import { config } from '../config.js';
import type { NlpEntity } from '@lucidreview/shared';

export type { NlpEntity };

export interface NlpExtractionResponse {
  entities: NlpEntity[];
  processingTimeMs: number;
}

export class CtakesClient {
  private baseUrl = config.ctakes.url;

  async analyze(text: string): Promise<NlpExtractionResponse> {
    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `cTAKES NLP error: ${response.status} ${response.statusText}`,
      );
    }
    return response.json() as Promise<NlpExtractionResponse>;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
