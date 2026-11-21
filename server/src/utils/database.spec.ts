import { retryOnDeadlock } from 'src/utils/database.js';
import { describe, expect, it, vitest } from 'vitest';

const deadlock = () => Object.assign(new Error('deadlock detected'), { code: '40P01' });

describe(retryOnDeadlock.name, () => {
  it('should return the result of a successful operation', async () => {
    const operation = vitest.fn().mockResolvedValue('ok');

    await expect(retryOnDeadlock(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry an operation aborted by a deadlock', async () => {
    const operation = vitest.fn().mockRejectedValueOnce(deadlock()).mockResolvedValue('ok');

    await expect(retryOnDeadlock(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should give up after three deadlocks', async () => {
    const operation = vitest.fn().mockRejectedValue(deadlock());

    await expect(retryOnDeadlock(operation)).rejects.toMatchObject({ code: '40P01' });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should not retry other errors', async () => {
    const operation = vitest.fn().mockRejectedValue(new Error('boom'));

    await expect(retryOnDeadlock(operation)).rejects.toThrow('boom');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
