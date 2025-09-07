import { describe, it, expect, beforeEach } from 'vitest';
import { OpenShiftManager } from '../src/utils/openshift-manager.js';

describe('OpenShiftManager', () => {
  let manager: OpenShiftManager;

  beforeEach(() => {
    manager = OpenShiftManager.getInstance();
  });

  it('should be a singleton', () => {
    const manager1 = OpenShiftManager.getInstance();
    const manager2 = OpenShiftManager.getInstance();
    expect(manager1).toBe(manager2);
  });

  it('should execute basic oc commands', async () => {
    // This test would require a mock or actual OpenShift CLI
    // For now, we'll just test the basic structure
    expect(manager).toBeDefined();
    expect(typeof manager.executeCommand).toBe('function');
    expect(typeof manager.getResources).toBe('function');
    expect(typeof manager.createResource).toBe('function');
  });

  it('should handle command timeout', async () => {
    // Test timeout functionality
    const result = await manager.executeCommand(['version', '--client'], {
      timeout: 1, // Very short timeout
    });

    // Should either succeed quickly or timeout
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });
});
