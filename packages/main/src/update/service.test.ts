import { describe, expect, it, vi } from 'vitest';
import { UpdateService } from './service';

const mockFetch = (body: unknown, initSpy?: (input: string, init?: RequestInit) => void) => {
  return vi.fn(async (input: string, init?: RequestInit) => {
    initSpy?.(input, init);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
};

describe('UpdateService', () => {
  it('returns idle status by default', () => {
    const service = new UpdateService({ version: '0.2.0' });
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        state: 'idle',
        currentVersion: '0.2.0',
        latestVersion: null,
        checkedAt: null,
        autoCheckEnabled: true
      })
    );
  });

  it('performs a read-only manifest fetch for manual checks', async () => {
    const now = vi.fn(() => new Date('2024-01-02T10:00:00Z'));
    const fetchImpl = mockFetch({ version: '0.2.1', message: 'Relay is healthy.' });
    const service = new UpdateService({ version: '0.2.1', now, fetchImpl, manifestUrl: 'https://relay.test/manifest.json' });

    const status = await service.checkForUpdates({ source: 'manual' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('https://relay.test/manifest.json', expect.objectContaining({ method: 'GET' }));
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init).toMatchObject({
      credentials: 'omit',
      cache: 'no-store'
    });
    const acceptHeader = init?.headers instanceof Headers ? init.headers.get('Accept') : (init?.headers as Record<string, string> | undefined)?.Accept;
    expect(acceptHeader).toBe('application/json');
    expect(status.state).toBe('up_to_date');
    expect(status.checkedAt).toBe('2024-01-02T10:00:00.000Z');
    expect(status.latestVersion).toBe('0.2.1');
    expect(status.message).toContain('Relay is healthy');
  });

  it('flags update availability without leaking manifest payloads', async () => {
    const fetchImpl = mockFetch({
      version: '0.2.5',
      message: 'New build ready',
      servers: [{ alias: 'secret' }]
    });
    const service = new UpdateService({ version: '0.2.1', fetchImpl });

    const status = await service.checkForUpdates({ source: 'manual' });

    expect(status.state).toBe('update_available');
    expect(status.latestVersion).toBe('0.2.5');
    expect(status.message).toBe('New build ready');
    expect(Object.prototype.hasOwnProperty.call(status, 'servers')).toBe(false);
  });

  it('updates the auto-check preference', () => {
    const service = new UpdateService();
    service.setAutoCheckEnabled(false);
    expect(service.getStatus().autoCheckEnabled).toBe(false);

    service.setAutoCheckEnabled(true);
    expect(service.getStatus().autoCheckEnabled).toBe(true);
  });

  it('preserves the preference after running a check', async () => {
    const fetchImpl = mockFetch({ version: '0.3.0' });
    const service = new UpdateService({ version: '0.3.0', fetchImpl });
    service.setAutoCheckEnabled(false);

    const status = await service.checkForUpdates({ source: 'manual' });

    expect(status.autoCheckEnabled).toBe(false);
  });

  it('skips auto checks entirely when the preference is disabled', async () => {
    const fetchImpl = mockFetch({ version: '1.0.0' });
    const service = new UpdateService({ version: '1.0.0', fetchImpl });
    service.setAutoCheckEnabled(false);

    const status = await service.checkForUpdates({ source: 'auto' });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(status.state).toBe('idle');
    expect(status.message).toMatch(/disabled/i);
  });

  it('reports offline state when the manifest fetch fails', async () => {
    const offlineError = Object.assign(new Error('offline'), { code: 'ENOTFOUND' });
    const fetchImpl = vi.fn().mockRejectedValue(offlineError);
    const service = new UpdateService({ version: '1.0.0', fetchImpl });

    const status = await service.checkForUpdates({ source: 'manual' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(status.state).toBe('offline');
    expect(status.message).toMatch(/unable to reach/i);
  });
});
