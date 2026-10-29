export interface CandidateBoardRow {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  stage: 'Applied' | 'Screening' | 'Technical Interview' | 'Manager Interview' | 'Offer Pending' | 'Offer Sent';
  daysInStage: number;
  lastActivityDate: string;
  assignedRecruiter: string;
  notes?: string;
}

export interface StalledCandidateAlert {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  stage: string;
  daysInStage: number;
  lastActivityDate: string;
  assignedRecruiter: string;
  urgency: 'Critical' | 'High' | 'Medium';
  priorityRank: number;
  recommendedAction: string;
}

export interface StallAnalysisResult {
  totalCandidates: number;
  stalledCount: number;
  thresholdDays: number;
  alerts: StalledCandidateAlert[];
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
  };
}

const stageWeights: Record<string, number> = {
  'Offer Sent': 5.0,
  'Offer Pending': 4.5,
  'Manager Interview': 3.5,
  'Technical Interview': 3.0,
  'Screening': 2.0,
  'Applied': 1.5
};

function getRecommendedAction(stage: string, days: number, _recruiter: string): string {
  switch (stage.toLowerCase()) {
    case 'offer sent':
      return `Call candidate directly to address concerns, negotiate compensation, or confirm signing deadline (${days} days since offer).`;
    case 'offer pending':
      return `Prompt the hiring manager and HR VP to sign off on offer package approval.`;
    case 'manager interview':
      return `Nudge hiring manager for scorecard submission and decision on next round.`;
    case 'technical interview':
      return `Follow up with engineering interview panel for coding evaluation score.`;
    case 'screening':
      return `Send short email update or advance candidate to technical screen (${days} days pending).`;
    case 'applied':
      return `Conduct initial resume review or trigger candidate rejection notice.`;
    default:
      return `Send candidate check-in email to prevent drop-off and confirm ongoing interest.`;
  }
}

export function parseHiringBoardCSV(csvText: string): CandidateBoardRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const firstLine = lines[0] ?? '';
  const header = firstLine.split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const idIdx = header.findIndex((h) => h.includes('id'));
  const nameIdx = header.findIndex((h) => h.includes('name'));
  const emailIdx = header.findIndex((h) => h.includes('email'));
  const roleIdx = header.findIndex((h) => h.includes('role') || h.includes('position'));
  const stageIdx = header.findIndex((h) => h.includes('stage') || h.includes('status'));
  const daysIdx = header.findIndex((h) => h.includes('day'));
  const lastActIdx = header.findIndex((h) => h.includes('date') || h.includes('activity'));
  const recruiterIdx = header.findIndex((h) => h.includes('recruiter') || h.includes('owner'));

  const rows: CandidateBoardRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const row = rawLine.trim();
    if (!row) continue;
    const cols = row.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    // Skip empty rows (e.g. ",,,,")
    if (cols.every((c) => !c)) continue;

    const rawId = (idIdx !== -1 ? cols[idIdx] : cols[0])?.trim() ?? '';
    const rawName = (nameIdx !== -1 ? cols[nameIdx] : cols[1])?.trim() ?? '';
    const rawEmail = (emailIdx !== -1 ? cols[emailIdx] : cols[2])?.trim() ?? '';
    const rawRole = (roleIdx !== -1 ? cols[roleIdx] : cols[3])?.trim() ?? '';
    const rawStage = (stageIdx !== -1 ? cols[stageIdx] : cols[4])?.trim() ?? '';
    const rawDays = (daysIdx !== -1 ? cols[daysIdx] : cols[5])?.trim() ?? '';
    const rawLastAct = (lastActIdx !== -1 ? cols[lastActIdx] : cols[6])?.trim() ?? '';
    const rawRecruiter = (recruiterIdx !== -1 ? cols[recruiterIdx] : cols[7])?.trim() ?? '';

    // Disallow rows where candidate identity is absent
    if (!rawName && !rawEmail && !rawId) continue;

    const candidateId = rawId || (rawName ? `CAN-${rawName.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : `CAN-${i}`);
    const candidateName = rawName || rawEmail || candidateId;
    const candidateEmail = rawEmail || 'candidate@example.com';
    const role = rawRole || 'Software Engineer';
    const stage = (rawStage || 'Screening') as CandidateBoardRow['stage'];
    const daysInStage = parseInt(rawDays || '0', 10) || 0;
    const lastActivityDate = rawLastAct || new Date().toISOString().slice(0, 10);
    const assignedRecruiter = rawRecruiter || 'Unassigned';

    rows.push({
      candidateId,
      candidateName,
      candidateEmail,
      role,
      stage,
      daysInStage,
      lastActivityDate,
      assignedRecruiter
    });
  }

  return rows;
}

export function analyzeStalledCandidates(
  candidates: CandidateBoardRow[],
  thresholdDays = 5
): StallAnalysisResult {
  const stalled = candidates.filter((c) => c.daysInStage >= thresholdDays);

  const scored = stalled.map((c) => {
    const weight = stageWeights[c.stage] ?? 1.5;
    const score = c.daysInStage * weight;
    let urgency: 'Critical' | 'High' | 'Medium' = 'Medium';
    if (score >= 30 || c.daysInStage >= 14 || c.stage === 'Offer Sent' || c.stage === 'Offer Pending') {
      urgency = 'Critical';
    } else if (score >= 18 || c.daysInStage >= 8) {
      urgency = 'High';
    }
    return { candidate: c, score, urgency };
  });

  scored.sort((a, b) => b.score - a.score);

  const alerts: StalledCandidateAlert[] = scored.map((item, idx) => ({
    id: `stall-${item.candidate.candidateId}`,
    candidateId: item.candidate.candidateId,
    candidateName: item.candidate.candidateName,
    candidateEmail: item.candidate.candidateEmail,
    role: item.candidate.role,
    stage: item.candidate.stage,
    daysInStage: item.candidate.daysInStage,
    lastActivityDate: item.candidate.lastActivityDate,
    assignedRecruiter: item.candidate.assignedRecruiter,
    urgency: item.urgency,
    priorityRank: idx + 1,
    recommendedAction: getRecommendedAction(item.candidate.stage, item.candidate.daysInStage, item.candidate.assignedRecruiter)
  }));

  const criticalCount = alerts.filter((a) => a.urgency === 'Critical').length;
  const highCount = alerts.filter((a) => a.urgency === 'High').length;
  const mediumCount = alerts.filter((a) => a.urgency === 'Medium').length;

  return {
    totalCandidates: candidates.length,
    stalledCount: alerts.length,
    thresholdDays,
    alerts,
    summary: {
      criticalCount,
      highCount,
      mediumCount
    }
  };
}

export function generateSampleHiringBoardCSV(): string {
  return `candidate_id,candidate_name,candidate_email,role,stage,days_in_stage,last_activity_date,assigned_recruiter`;
}
