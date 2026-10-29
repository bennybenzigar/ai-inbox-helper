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
