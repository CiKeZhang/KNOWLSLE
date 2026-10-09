import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { WeekUtil, dayjs } from '../common/utils/week.util';
import { CryptoUtil } from '../common/utils/crypto.util';
import { CheckInStatus } from '../common/enums';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 学院考研工作报表:核心指标汇总 */
  async summary(params: {
    departmentId?: number;
    majorId?: number;
    classId?: number;
    semester?: string; // YYYY-S1 / YYYY-S2
    month?: string;     // YYYY-MM
  }) {
    const studentWhere: Record<string, unknown> = { role: 'STUDENT', status: 'ACTIVE' };
    if (params.departmentId) studentWhere.departmentId = params.departmentId;
    if (params.majorId) studentWhere.majorId = params.majorId;
    if (params.classId) studentWhere.classId = params.classId;
    const students = await this.prisma.user.findMany({
      where: studentWhere,
      include: {
        studentProfile: true,
        progressArchive: true,
        class: { select: { name: true } },
        major: { select: { name: true } },
      },
    });
    const total = students.length;

    const stageDistribution: Record<string, number> = {};
    let admitted = 0;
    let examPassed = 0;
    const tierDistribution: Record<string, number> = {};
    const schools = await this.prisma.school.findMany({
      select: { name: true, tier: true },
    });
    const tierMap = new Map(schools.map((s) => [s.name, s.tier]));

    for (const s of students) {
      const stage = s.studentProfile?.currentStage ?? 'NOT_STARTED';
      stageDistribution[stage] = (stageDistribution[stage] ?? 0) + 1;
      if (s.progressArchive?.finalResult === 'ADMITTED') admitted++;
      if (s.progressArchive?.examTotal && s.progressArchive.examTotal >= 250) examPassed++;
      // targetSchoolName 为加密存储,需先解密再用于院校层次统计
      let sn = s.progressArchive?.targetSchoolName;
      if (sn && typeof sn === 'string' && sn.includes(':') && sn.split(':').length === 3) {
        try { sn = CryptoUtil.decrypt(sn); } catch { /* 保留原值 */ }
      }
      if (sn) {
        const t = tierMap.get(sn) ?? 'DOUBLE_NON';
        tierDistribution[t] = (tierDistribution[t] ?? 0) + 1;
      }
    }

    // 打卡统计:本月或学期
    let since: Date | undefined;
    if (params.month) {
      since = dayjs(`${params.month}-01`).startOf('month').toDate();
    } else if (params.semester) {
      // YYYY-S1:9月 1 日开始;S2:3月 1 日开始
      const m = /(\d{4})-S([12])/.exec(params.semester);
      if (m) {
        const year = parseInt(m[1], 10);
        const sem = m[2];
        since = new Date(year, sem === '1' ? 8 : 2, 1);
      }
    }
    const checkinWhere: Record<string, unknown> = {};
    if (since) checkinWhere.weekStart = { gte: since };
    const checkinRecords = await this.prisma.checkInRecord.findMany({
      where: checkinWhere,
      select: { studentId: true, status: true },
    });
    const studentIds = new Set(students.map((s) => s.id));
    const scopedCheckins = checkinRecords.filter((r) => studentIds.has(r.studentId));
    const onTime = scopedCheckins.filter((r) => r.status === CheckInStatus.ON_TIME).length;
    const late = scopedCheckins.filter((r) => r.status === CheckInStatus.LATE).length;
    const missing = scopedCheckins.filter((r) => r.status === CheckInStatus.MISSING).length;
    const completed = onTime + late;
    const checkinRate =
      completed + missing === 0 ? 0 : Math.round((completed / (completed + missing)) * 1000) / 10;

    return {
      scope: params,
      totalStudents: total,
      stageDistribution,
      tierDistribution,
      examPassed,
      examPassedRate: total === 0 ? 0 : Math.round((examPassed / total) * 1000) / 10,
      admitted,
      admittedRate: total === 0 ? 0 : Math.round((admitted / total) * 1000) / 10,
      checkin: {
        onTime,
        late,
        missing,
        completed,
        checkinRate,
      },
    };
  }

  /** 导出周度打卡统计表 Excel */
  async exportCheckinExcel(params: {
    departmentId?: number;
    majorId?: number;
    classId?: number;
    weekStart?: Date;
  }) {
    const weekStart = params.weekStart ?? WeekUtil.weekStart();
    const weekEnd = WeekUtil.weekEnd(weekStart);
    const studentWhere: Record<string, unknown> = { role: 'STUDENT', status: 'ACTIVE' };
    if (params.departmentId) studentWhere.departmentId = params.departmentId;
    if (params.majorId) studentWhere.majorId = params.majorId;
    if (params.classId) studentWhere.classId = params.classId;

    const students = await this.prisma.user.findMany({
      where: studentWhere,
      include: {
        class: { select: { name: true } },
        major: { select: { name: true } },
        studentProfile: { select: { currentStage: true } },
      },
      orderBy: [{ classId: 'asc' }, { username: 'asc' },
      ],
    });
    const records = await this.prisma.checkInRecord.findMany({
      where: { weekStart, studentId: { in: students.map((s) => s.id) } },
    });
    const recMap = new Map(records.map((r) => [r.studentId, r]));

    const wb = new ExcelJS.Workbook();
    wb.creator = '考研进度管控系统';
    wb.created = new Date();
    const ws = wb.addWorksheet('周度打卡统计', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = [
      { header: '学号', key: 'username', width: 14 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '班级', key: 'className', width: 16 },
      { header: '专业', key: 'majorName', width: 16 },
      { header: '当前阶段', key: 'stage', width: 16 },
      { header: '本周打卡', key: 'status', width: 12 },
      { header: '学习时长(h)', key: 'studyHours', width: 12 },
      { header: '本周困难', key: 'difficulties', width: 40 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    for (const s of students) {
      const r = recMap.get(s.id);
      ws.addRow({
        username: s.username,
        name: s.name,
        className: s.class?.name ?? '',
        majorName: s.major?.name ?? '',
        stage: s.studentProfile?.currentStage ?? '',
        status: r ? r.status : '未打卡',
        studyHours: r ? Number(r.studyHours) : '',
        difficulties: r?.difficulties ?? '',
      });
    }
    const buffer = await wb.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: `周度打卡统计_${WeekUtil.weekKey(weekStart)}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /** 导出进度汇总表 PDF */
  async exportProgressPdf(params: {
    departmentId?: number;
    majorId?: number;
    classId?: number;
  }) {
    const summary = await this.summary(params);
    return new Promise<{ buffer: Buffer; filename: string; contentType: string }>((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          buffer,
          filename: `考研进度汇总_${dayjs().format('YYYYMMDD')}.pdf`,
          contentType: 'application/pdf',
        });
      });
      doc
        .fontSize(18)
        .text('学院考研进度汇总表', { align: 'center' })
        .moveDown();
      doc.fontSize(11);
      doc.text(`生成时间: ${dayjs().format('YYYY-MM-DD HH:mm')}`);
      doc.text(`学生总数: ${summary.totalStudents}`);
      doc.text(`初试通过率: ${summary.examPassedRate}% (${summary.examPassed}/${summary.totalStudents})`);
      doc.text(`上岸率: ${summary.admittedRate}% (${summary.admitted}/${summary.totalStudents})`);
      doc.text(`打卡完成率: ${summary.checkin.checkinRate}%`);
      doc.moveDown();
      doc.text('阶段分布:');
      for (const [k, v] of Object.entries(summary.stageDistribution)) {
        doc.text(`  ${k}: ${v} 人`);
      }
      doc.moveDown();
      doc.text('院校层次分布:');
      for (const [k, v] of Object.entries(summary.tierDistribution)) {
        doc.text(`  ${k}: ${v} 人`);
      }
      doc.end();
    });
  }

  /** 全院维度打卡数据总览(支持按学期/月份) */
  async checkinAnalysis(params: { semester?: string; month?: string }) {
    const summary = await this.summary(params);
    // 按月份的打卡趋势
    const since = params.semester
      ? new Date(parseInt(params.semester.slice(0, 4)), params.semester.endsWith('1') ? 8 : 2, 1)
      : params.month
      ? dayjs(`${params.month}-01`).startOf('month').toDate()
      : dayjs().subtract(6, 'month').toDate();
    const records = await this.prisma.checkInRecord.findMany({
      where: { weekStart: { gte: since } },
      select: { weekStart: true, status: true },
    });
    const monthMap: Record<string, { onTime: number; late: number; missing: number }> = {};
    for (const r of records) {
      const mk = dayjs(r.weekStart).format('YYYY-MM');
      if (!monthMap[mk]) monthMap[mk] = { onTime: 0, late: 0, missing: 0 };
      if (r.status === CheckInStatus.ON_TIME) monthMap[mk].onTime++;
      else if (r.status === CheckInStatus.LATE) monthMap[mk].late++;
      else monthMap[mk].missing++;
    }
    return {
      summary,
      monthlyTrend: Object.entries(monthMap).map(([k, v]) => ({ month: k, ...v })),
    };
  }
}
