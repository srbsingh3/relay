import { describe, expect, it, vi } from 'vitest';
import { UpdateService } from './service';

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

  it('marks status as up to date after a manual check', async () => {
    const now = vi.fn(() => new Date('2024-01-02T10:00:00Z'));
    const service = new UpdateService({ version: '0.2.1', now });

    const status = await service.checkForUpdates({ source: 'manual' });

    expect(status.state).toBe('up_to_date');
    expect(status.checkedAt).toBe('2024-01-02T10:00:00.000Z');
    expect(status.latestVersion).toBe('0.2.1');
    expect(status.message).toMatch(/up to date/i);
  });

  it('updates the auto-check preference', () => {
    const service = new UpdateService();
    service.setAutoCheckEnabled(false);
    expect(service.getStatus().autoCheckEnabled).toBe(false);

    service.setAutoCheckEnabled(true);
    expect(service.getStatus().autoCheckEnabled).toBe(true);
  });

  it('preserves the preference after running a check', async () => {
    const service = new UpdateService({ version: '0.3.0' });
    service.setAutoCheckEnabled(false);

    const status = await service.checkForUpdates({ source: 'manual' });

    expect(status.autoCheckEnabled).toBe(false);
  });
});
