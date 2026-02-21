import { fetch } from 'undici';
import type fhir4 from 'fhir/r4';
import { config } from '../config.js';

export class HapiFhirClient {
  private baseUrl = config.hapiFhir.baseUrl;

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/fhir+json',
    };
    if (body) {
      headers['Content-Type'] = 'application/fhir+json';
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `HAPI FHIR ${method} ${path}: ${response.status} ${response.statusText} - ${text}`,
      );
    }
    return response.json() as T;
  }

  async create<T extends fhir4.Resource>(resource: T): Promise<T> {
    return this.request<T>('POST', `/${resource.resourceType}`, resource);
  }

  async read<T extends fhir4.Resource>(
    resourceType: string,
    id: string,
  ): Promise<T> {
    return this.request<T>('GET', `/${resourceType}/${id}`);
  }

  async search<T extends fhir4.Resource>(
    resourceType: string,
    params: Record<string, string>,
  ): Promise<fhir4.Bundle> {
    const searchParams = new URLSearchParams(params);
    return this.request<fhir4.Bundle>(
      'GET',
      `/${resourceType}?${searchParams.toString()}`,
    );
  }

  async transaction(bundle: fhir4.Bundle): Promise<fhir4.Bundle> {
    return this.request<fhir4.Bundle>('POST', '', bundle);
  }

  async operation(
    resourceType: string,
    id: string | null,
    operation: string,
    params?: unknown,
  ): Promise<unknown> {
    const path = id
      ? `/${resourceType}/${id}/${operation}`
      : `/${resourceType}/${operation}`;
    if (params) {
      return this.request('POST', path, params);
    }
    return this.request('GET', path);
  }

  async evaluateLibrary(
    libraryId: string,
    patientId: string,
  ): Promise<fhir4.Parameters> {
    const params: fhir4.Parameters = {
      resourceType: 'Parameters',
      parameter: [
        { name: 'patientId', valueString: patientId },
      ],
    };
    return this.request<fhir4.Parameters>(
      'POST',
      `/Library/${libraryId}/$evaluate`,
      params,
    );
  }
}
