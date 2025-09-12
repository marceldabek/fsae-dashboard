import { describe, it, expect } from 'vitest';
import { criticalPath } from './criticalPath';
import { Attachment, Dependency } from '@/types/project';

function att(id: string, s: number, e: number): Attachment {
  return { id, timelineId: 't', projectId: 'p', start: s, end: e };
}

describe('criticalPath', () => {
  it('finds longest chain by duration', () => {
    // a(0-5), b(5-9), c(2-8), d(8-14), e(14-20)
    const attachments: Attachment[] = [
      att('a',0,5),
      att('b',5,9),
      att('c',2,8),
      att('d',8,14),
      att('e',14,20),
    ];
    const deps: Dependency[] = [
      { id:'ab', fromAttachmentId:'a', toAttachmentId:'b', type:'fs' },
      { id:'ac', fromAttachmentId:'a', toAttachmentId:'c', type:'fs' },
      { id:'cd', fromAttachmentId:'c', toAttachmentId:'d', type:'fs' },
      { id:'bd', fromAttachmentId:'b', toAttachmentId:'d', type:'fs' },
      { id:'de', fromAttachmentId:'d', toAttachmentId:'e', type:'fs' },
    ];
    const result = criticalPath(attachments, deps);
    // Longest duration path: a(5) + c(6) + d(6) + e(6) = 23 vs a+b+d+e = 5+4+6+6=21
    expect(result.ids).toEqual(['a','c','d','e']);
    expect(result.totalDuration).toBe(23);
  });

  it('throws on cycle', () => {
    const attachments: Attachment[] = [att('a',0,5), att('b',5,10)];
    const deps: Dependency[] = [
      { id:'ab', fromAttachmentId:'a', toAttachmentId:'b' },
      { id:'ba', fromAttachmentId:'b', toAttachmentId:'a' },
    ];
    expect(()=>criticalPath(attachments, deps)).toThrow(/cycle/);
  });
});
