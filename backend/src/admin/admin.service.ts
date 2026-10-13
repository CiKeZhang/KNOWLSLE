import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { SchoolTier } from '../common/enums';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opLog: OperationLogService,
  ) {}

  // ---------- 打卡规则配置 ----------
  async getCheckInRule() {
    const rule = await this.prisma.checkInRule.findFirst({
      orderBy: { id: 'asc' },
    });
    return rule;
  }

  async updateCheckInRule(data: Record<string, unknown>, operatorId: number) {
    const existing = await this.prisma.checkInRule.findFirst({ orderBy: { id: 'asc' } });
    const rule = existing
      ? await this.prisma.checkInRule.update({ where: { id: existing.id }, data })
      : await this.prisma.checkInRule.create({ data } as any);
    await this.opLog.record(operatorId, 'update_checkin_rule', 'rule', data);
    return rule;
  }

  // ---------- 院校数据库维护 ----------
  async listSchools(params: {
    keyword?: string;
    tier?: SchoolTier;
    region?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (params.tier) where.tier = params.tier;
    if (params.region) where.region = { contains: params.region };
    if (params.keyword) {
      where.OR = [{ name: { contains: params.keyword } }, { code: { contains: params.keyword } }];
    }
    const [total, items] = await Promise.all([
      this.prisma.school.count({ where }),
      this.prisma.school.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
        include: { _count: { select: { programs: true } } },
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async createSchool(data: {
    name: string;
    code?: string;
    tier: SchoolTier;
    region?: string;
    province?: string;
    city?: string;
    is985?: boolean;
    is211?: boolean;
    isDoubleFirst?: boolean;
    priorityWeight?: number;
    website?: string;
  }, operatorId: number) {
    const school = await this.prisma.school.create({ data });
    await this.opLog.record(operatorId, 'create_school', `school:${school.id}`, data);
    return school;
  }

  async updateSchool(id: number, data: Record<string, unknown>, operatorId: number) {
    const school = await this.prisma.school.update({ where: { id }, data });
    await this.opLog.record(operatorId, 'update_school', `school:${id}`, data);
    return school;
  }

  async deleteSchool(id: number, operatorId: number) {
    await this.prisma.school.delete({ where: { id } });
    await this.opLog.record(operatorId, 'delete_school', `school:${id}`, {});
    return { ok: true };
  }

  // ---------- 招生专业维护 ----------
  async listPrograms(schoolId: number) {
    return this.prisma.majorProgram.findMany({
      where: { schoolId },
      orderBy: { majorName: 'asc' },
    });
  }

  async createProgram(data: {
    schoolId: number;
    majorName: string;
    majorCode?: string;
    reportRatio2023?: number;
    reportRatio2024?: number;
    reportRatio2025?: number;
    reexamLine2023?: number;
    reexamLine2024?: number;
    reexamLine2025?: number;
    enrollCount2023?: number;
    enrollCount2024?: number;
    enrollCount2025?: number;
    exemptRatio?: number;
    examSubjects?: string[];
    isCollegeAligned?: boolean;
  }, operatorId: number) {
    const p = await this.prisma.majorProgram.create({ data });
    await this.opLog.record(operatorId, 'create_program', `program:${p.id}`, data);
    return p;
  }

  async updateProgram(id: number, data: Record<string, unknown>, operatorId: number) {
    const p = await this.prisma.majorProgram.update({ where: { id }, data });
    await this.opLog.record(operatorId, 'update_program', `program:${id}`, data);
    return p;
  }

  // ---------- 系统配置 ----------
  async listConfigs() {
    return this.prisma.systemConfig.findMany();
  }

  async getConfig(key: string) {
    const c = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (!c) throw new NotFoundException('配置项不存在');
    return c;
  }

  async updateConfig(key: string, value: unknown, description: string, operatorId: number) {
    const c = await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value: value as any, description: description ?? undefined },
      create: { key, value: value as any, description },
    });
    await this.opLog.record(operatorId, 'update_config', `config:${key}`, { value });
    return c;
  }

  // ---------- 关键节点维护 ----------
  async listKeyNodes() {
    return this.prisma.keyNodeReminder.findMany({ orderBy: { remindAt: 'asc' } });
  }

  async updateKeyNode(id: number, data: { remindAt?: Date; enabled?: boolean; description?: string }, operatorId: number) {
    const n = await this.prisma.keyNodeReminder.update({ where: { id }, data });
    await this.opLog.record(operatorId, 'update_key_node', `node:${id}`, data);
    return n;
  }

  // ---------- 组织机构维护 ----------
  async listDepartments() {
    return this.prisma.department.findMany({ include: { _count: { select: { majors: true, classes: true } } } });
  }

  async createDepartment(name: string, code: string, parentId?: number, operatorId?: number) {
    const d = await this.prisma.department.create({ data: { name, code, parentId } });
    if (operatorId) await this.opLog.record(operatorId, 'create_department', `dept:${d.id}`, { name, code });
    return d;
  }

  async listMajors(departmentId?: number) {
    return this.prisma.major.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: { department: { select: { name: true } } },
    });
  }

  async createMajor(name: string, code: string, departmentId: number, operatorId?: number) {
    const m = await this.prisma.major.create({ data: { name, code, departmentId } });
    if (operatorId) await this.opLog.record(operatorId, 'create_major', `major:${m.id}`, { name, code });
    return m;
  }

  async listClasses(majorId?: number, departmentId?: number) {
    return this.prisma.class.findMany({
      where: {
        ...(majorId ? { majorId } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      include: {
        major: { select: { name: true } },
        department: { select: { name: true } },
        counselor: { select: { id: true, name: true } },
      },
    });
  }

  async createClass(
    data: { name: string; grade: string; majorId: number; departmentId: number; counselorId?: number },
    operatorId?: number,
  ) {
    const c = await this.prisma.class.create({ data });
    if (operatorId) await this.opLog.record(operatorId, 'create_class', `class:${c.id}`, data);
    return c;
  }
}
