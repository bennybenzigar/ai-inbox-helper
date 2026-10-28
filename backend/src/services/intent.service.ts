import { INTENTS, type Intent } from '../models/types';
const rules: Array<[Intent, RegExp]> = [
  ['Interview Scheduling', /interview|availability|schedule|calendar|meeting|time slot|reschedule/i],
  ['Salary & Compensation', /salary|compensation|pay range|expected ctc|package|remuneration/i],
  ['Document Requests', /document|resume|cv|certificate|passport|reference|upload|attachment/i],
  ['Job Details', /job description|responsibilities|role details|job requirements|work location|remote work|develop(er|r)|engineer|angular|react|frontend|backend|full.?stack|post of|position of|role of/i],
  ['Application Status', /application status|application for|applying for|applied for|job application|candidacy|candidature|follow.?up|update on my application|heard back|recruitment process/i]
];
export function classifyIntent(subject: string, body: string): { intent: Intent; confidence: number } {
  const content = `${subject}\n${body}`;
  for (const [intent, pattern] of rules) if (pattern.test(content)) return { intent, confidence: 0.91 };
  return { intent: INTENTS[5], confidence: 0.48 };
}
