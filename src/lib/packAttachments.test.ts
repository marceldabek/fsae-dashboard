import { describe, it, expect } from 'vitest';
import { packAttachments } from './packAttachments';
import { Attachment } from '@/types/project';

function a(id: string, s: number, e: number): Attachment {
  return { id, timelineId: 't', projectId: 'p', start: s, end: e };
}

describe('packAttachments', () => {
  it('puts non-overlapping in single lane', () => {
    const { laneCount, laneOf } = packAttachments([
      a('a', 0, 10),
      a('b', 10, 20),
      a('c', 20, 30),
    ]);
    expect(laneCount).toBe(1);
    expect([...laneOf.values()].every(v => v === 0)).toBe(true);
  });

  it('splits fully overlapping chain', () => {
    const { laneCount } = packAttachments([
      a('a', 0, 30),
      a('b', 5, 25),
      a('c', 10, 20),
    ]);
    expect(laneCount).toBe(3);
  });

  it('reuses lanes greedily', () => {
    const { laneCount, laneOf } = packAttachments([
      a('a', 0, 10),
      a('b', 0, 5),
      a('c', 5, 10),
      a('d', 10, 15),
    ]);
    // a occupies lane 0 until 10. b goes to lane1 (overlaps with a). c can reuse lane1 after b ends at 5.
    expect(laneCount).toBe(2);
    expect(laneOf.get('a')).toBe(0);
    expect(laneOf.get('b')).toBe(1);
    expect(laneOf.get('c')).toBe(1);
  });

  it('stable ordering for equal starts', () => {
    const items = [a('a', 0, 5), a('b', 0, 5), a('c', 0, 5)];
    const { laneOf, laneCount } = packAttachments(items);
    expect(laneCount).toBe(3);
    expect(laneOf.get('a')).toBe(0);
    expect(laneOf.get('b')).toBe(1);
    expect(laneOf.get('c')).toBe(2);
  });
});
