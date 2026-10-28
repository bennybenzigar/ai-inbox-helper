import test from 'node:test';
import assert from 'node:assert/strict';
import { MockAIProvider } from '../src/services/ai.service';
import type { Message } from '../src/models/types';
test('mock provider returns a draft without sending email',async()=>{const p=new MockAIProvider();const m:Message={id:'t1',source:'demo',senderName:'Alex Chen',senderEmail:'alex@example.com',subject:'Interview',body:'Please schedule',receivedAt:new Date().toISOString(),intent:'Interview Scheduling',confidence:.9,status:'none',hasAttachments:false};const draft=await p.generateDraft(m);assert.match(draft,/Hi Alex/);assert.match(draft,/Best regards/);});
