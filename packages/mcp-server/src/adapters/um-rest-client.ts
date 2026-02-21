import { fetch } from 'undici';
import { config } from '../config.js';

export class UmRestClient {
  private baseUrl = config.umSystem.baseUrl;
  private apiKey = config.umSystem.apiKey;

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'X-API-Key': this.apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(config.umSystem.timeout),
    });
    if (!response.ok) {
      throw new Error(
        `UM system error: ${response.status} ${response.statusText} for ${path}`,
      );
    }
    return response.json() as T;
  }

  async getCase(caseNumber: string) {
    return this.get(`/api/cases/${caseNumber}`);
  }

  async getClinicalInfo(caseNumber: string) {
    return this.get(`/api/cases/${caseNumber}/clinical`);
  }

  async getAttachments(caseNumber: string) {
    return this.get(`/api/cases/${caseNumber}/attachments`);
  }

  async downloadAttachment(caseNumber: string, attachmentId: string) {
    return this.get(
      `/api/cases/${caseNumber}/attachments/${attachmentId}`,
    );
  }

  async getCaseHistory(caseNumber: string) {
    return this.get(`/api/cases/${caseNumber}/history`);
  }

  async getCaseNotes(caseNumber: string) {
    return this.get(`/api/cases/${caseNumber}/notes`);
  }

  async getMemberCoverage(memberId: string) {
    return this.get(`/api/members/${memberId}/coverage`);
  }
}
