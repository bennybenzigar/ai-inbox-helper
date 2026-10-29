import { pool, query } from '../database/database';

export interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  date: string;
  hoursWorked: number;
  leaveType: string;
}

export interface AttendanceFlag {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  hoursWorked: number;
  leaveType: string;
  flagType: 'Overtime' | 'Missing Hours' | 'Consecutive Leave' | 'Weekend Work' | 'Inconsistent Record';
  severity: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface AttendanceAnalysisResult {
  totalRecords: number;
  flaggedCount: number;
  employeesAnalyzed: number;
  flags: AttendanceFlag[];
  summary: {
    overtimeFlags: number;
    missingHourFlags: number;
    consecutiveLeaveFlags: number;
    weekendWorkFlags: number;
  };
}

export function parseAttendanceCSV(csvText: string): AttendanceRecord[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const firstLine = lines[0] ?? '';
  const header = firstLine.split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const idIdx = header.findIndex((h) => h.includes('id') || h.includes('emp'));
  const nameIdx = header.findIndex((h) => h.includes('name'));
  const dateIdx = header.findIndex((h) => h.includes('date'));
  const hoursIdx = header.findIndex((h) => h.includes('hour'));
  const leaveIdx = header.findIndex((h) => h.includes('leave'));

  const records: AttendanceRecord[] = [];

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
    const rawDate = (dateIdx !== -1 ? cols[dateIdx] : cols[2])?.trim() ?? '';
    const rawHours = (hoursIdx !== -1 ? cols[hoursIdx] : cols[3])?.trim() ?? '';
    const rawLeave = (leaveIdx !== -1 ? cols[leaveIdx] : cols[4])?.trim() ?? '';

    // Disallow rows with empty essential data: must have employee ID or Name
    if (!rawId && !rawName) continue;
    // Must also have some record data (date, hours, or leave)
    if (!rawDate && !rawHours && !rawLeave) continue;

    const employeeId = rawId || (rawName ? `EMP-${rawName.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : `EMP-${i}`);
    const employeeName = rawName || rawId;
    const date = rawDate || new Date().toISOString().slice(0, 10);
    const hoursWorked = parseFloat(rawHours || '0') || 0;
    const leaveType = rawLeave || 'None';

    records.push({
      employeeId,
      employeeName,
      date,
      hoursWorked,
      leaveType
    });
  }

  return records;
}

export function analyzeAttendance(records: AttendanceRecord[]): AttendanceAnalysisResult {
  const flags: AttendanceFlag[] = [];
  const employeeMap = new Map<string, AttendanceRecord[]>();

  for (const rec of records) {
    let list = employeeMap.get(rec.employeeId);
    if (!list) {
      list = [];
      employeeMap.set(rec.employeeId, list);
    }
    list.push(rec);
  }

  let overtimeFlags = 0;
  let missingHourFlags = 0;
  let consecutiveLeaveFlags = 0;
  let weekendWorkFlags = 0;

  for (const [empId, empRecords] of employeeMap.entries()) {
    empRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let consecutiveLeaveDays = 0;

    for (let j = 0; j < empRecords.length; j++) {
      const r = empRecords[j];
      if (!r) continue;

      const dayOfWeek = new Date(r.date).getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isLeave = r.leaveType.toLowerCase() !== 'none' && r.leaveType !== '';

      if (isLeave && !isWeekend) {
        consecutiveLeaveDays++;
        if (consecutiveLeaveDays >= 3) {
          consecutiveLeaveFlags++;
          flags.push({
            id: `flag-cl-${empId}-${j}`,
            employeeId: r.employeeId,
            employeeName: r.employeeName,
            date: r.date,
            hoursWorked: r.hoursWorked,
            leaveType: r.leaveType,
            flagType: 'Consecutive Leave',
            severity: consecutiveLeaveDays >= 5 ? 'high' : 'medium',
            explanation: `${r.employeeName} has logged ${consecutiveLeaveDays} consecutive days of leave without return.`
          });
        }
      } else if (!isWeekend) {
        consecutiveLeaveDays = 0;
      }

      if (r.hoursWorked > 12) {
        overtimeFlags++;
        flags.push({
          id: `flag-ot-${empId}-${j}`,
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          date: r.date,
          hoursWorked: r.hoursWorked,
          leaveType: r.leaveType,
          flagType: 'Overtime',
          severity: r.hoursWorked >= 15 ? 'high' : 'medium',
          explanation: `${r.employeeName} logged ${r.hoursWorked} hours, exceeding the standard daily maximum of 12 hours.`
        });
      }

      if (!isWeekend && r.hoursWorked === 0 && !isLeave) {
        missingHourFlags++;
        flags.push({
          id: `flag-mh-${empId}-${j}`,
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          date: r.date,
          hoursWorked: r.hoursWorked,
          leaveType: r.leaveType,
          flagType: 'Missing Hours',
          severity: 'high',
          explanation: `${r.employeeName} logged 0 hours on a weekday with no approved leave recorded.`
        });
      }

      if (isWeekend && r.hoursWorked > 0) {
        weekendWorkFlags++;
        flags.push({
          id: `flag-ww-${empId}-${j}`,
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          date: r.date,
          hoursWorked: r.hoursWorked,
          leaveType: r.leaveType,
          flagType: 'Weekend Work',
          severity: 'low',
          explanation: `${r.employeeName} logged ${r.hoursWorked} hours on a weekend (${dayOfWeek === 0 ? 'Sunday' : 'Saturday'}).`
        });
      }

      if (isLeave && r.leaveType.toLowerCase() !== 'half-day' && r.hoursWorked >= 4) {
        flags.push({
          id: `flag-ir-${empId}-${j}`,
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          date: r.date,
          hoursWorked: r.hoursWorked,
          leaveType: r.leaveType,
          flagType: 'Inconsistent Record',
          severity: 'medium',
          explanation: `${r.employeeName} logged ${r.hoursWorked} working hours while concurrently marked on full-day ${r.leaveType} leave.`
        });
      }
    }
  }

  return {
    totalRecords: records.length,
    flaggedCount: flags.length,
    employeesAnalyzed: employeeMap.size,
    flags,
    summary: {
      overtimeFlags,
      missingHourFlags,
      consecutiveLeaveFlags,
      weekendWorkFlags
    }
  };
}

export function generateSampleAttendanceCSV(): string {
  return `employee_id,employee_name,date,hours_worked,leave_type`;
}

export async function saveAttendanceAnalysis(result: AttendanceAnalysisResult): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM attendance_flags');
    await client.query('DELETE FROM attendance_meta');

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO attendance_meta (key, value, updated_at) VALUES 
       ('total_records', $1, $3),
       ('employees_analyzed', $2, $3)`,
      [String(result.totalRecords), String(result.employeesAnalyzed), now]
    );

    for (const flag of result.flags) {
      await client.query(
        `INSERT INTO attendance_flags 
         (id, employee_id, employee_name, date, hours_worked, leave_type, flag_type, severity, explanation, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          flag.id,
          flag.employeeId,
          flag.employeeName,
          flag.date,
          flag.hoursWorked,
          flag.leaveType,
          flag.flagType,
          flag.severity,
          flag.explanation,
          now
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getSavedAttendanceAnalysis(): Promise<AttendanceAnalysisResult | null> {
  const flags = await query<any>(
    'SELECT id, employee_id as "employeeId", employee_name as "employeeName", date, hours_worked as "hoursWorked", leave_type as "leaveType", flag_type as "flagType", severity, explanation FROM attendance_flags ORDER BY date DESC, employee_name ASC'
  );
  const metaRows = await query<{ key: string; value: string }>('SELECT key, value FROM attendance_meta');
  if (flags.length === 0 && metaRows.length === 0) {
    return null;
  }
  const metaMap = new Map(metaRows.map((m) => [m.key, m.value]));
  const totalRecords = parseInt(metaMap.get('total_records') || '0', 10) || flags.length;
  const employeesAnalyzed =
    parseInt(metaMap.get('employees_analyzed') || '0', 10) ||
    new Set(flags.map((f: any) => f.employeeId)).size;

  return {
    totalRecords,
    flaggedCount: flags.length,
    employeesAnalyzed,
    flags: flags.map((f: any) => ({
      id: f.id,
      employeeId: f.employeeId,
      employeeName: f.employeeName,
      date: f.date,
      hoursWorked: Number(f.hoursWorked),
      leaveType: f.leaveType,
      flagType: f.flagType,
      severity: f.severity,
      explanation: f.explanation
    })),
    summary: {
      overtimeFlags: flags.filter((f: any) => f.flagType === 'Overtime').length,
      missingHourFlags: flags.filter((f: any) => f.flagType === 'Missing Hours').length,
      consecutiveLeaveFlags: flags.filter((f: any) => f.flagType === 'Consecutive Leave').length,
      weekendWorkFlags: flags.filter((f: any) => f.flagType === 'Weekend Work').length
    }
  };
}

export async function deleteAttendanceFlag(id: string): Promise<boolean> {
  const res = await query('DELETE FROM attendance_flags WHERE id = $1 RETURNING id', [id]);
  return res.length > 0;
}

export async function deleteAttendanceFlags(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await query('DELETE FROM attendance_flags WHERE id = ANY($1) RETURNING id', [ids]);
  return res.length;
}

export async function clearAttendanceData(): Promise<void> {
  await query('DELETE FROM attendance_flags');
  await query('DELETE FROM attendance_meta');
}
