import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../common/services/operation-log.service';
import {
  CreateUserDto,
  UpdateUserDto,
  ListUsersDto,
  BatchImportDto,
} from './dto/user.dto';
import { UserRole, UserStatus } from '../common/enums';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { buildStudentScope } from '../common/utils/student-scope';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opLog: OperationLogService,
  ) {}

  /** 管理员创建用户:对接学院学籍系统/批量导入后也可单条补录 */
  async create(dto: CreateUserDto, operatorId: number) {
    const exists = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (exists) {
      throw new ConflictException(`用户名 ${dto.username} 已存在`);
    }
    const passwordHash = await bcrypt.hash(dto.password ?? `${dto.username}@2026`, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        name: dto.name,
        role: dto.role as unknown as UserRole,
        status: UserStatus.ACTIVE,
        studentNo: dto.studentNo,
        staffNo: dto.staffNo,
        phone: dto.phone,
        email: dto.email,
        passwordHash,
        departmentId: dto.departmentId,
        majorId: dto.majorId,
        classId: dto.classId,
      },
    });

    // 学生自动建立档案与 profile
    if (user.role === UserRole.STUDENT) {
      await this.prisma.studentProfile.create({
        data: {
          userId: user.id,
          enterYear: new Date().getFullYear() - 4,
          currentStage: 'NOT_STARTED',
        },
      });
      await this.prisma.progressArchive.create({
        data: { studentId: user.id },
      });
    }

    await this.opLog.record(operatorId, 'create_user', `user:${user.id}`, {
      username: user.username,
      role: user.role,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  /**
   * 用户列表。管理员可查全部用户;导师/辅导员只能查到自己管辖范围内的学生,
   * 且请求参数不能覆盖范围条件(否则 GET /users?role=STUDENT 就能拉到全院学生)。
   */
  async list(q: ListUsersDto, actor?: AuthUser) {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.pageSize ?? 20, 100);
    const filters: Record<string, unknown> = {};
    if (q.role) filters.role = q.role;
    if (q.departmentId) filters.departmentId = q.departmentId;
    if (q.majorId) filters.majorId = q.majorId;
    if (q.classId) filters.classId = q.classId;
    if (q.keyword) {
      filters.OR = [
        { name: { contains: q.keyword } },
        { username: { contains: q.keyword } },
        { studentNo: { contains: q.keyword } },
        { staffNo: { contains: q.keyword } },
      ];
    }
    // 非管理员:强制叠加学生数据范围(scope 与 filters 用 AND 并列,filters 无法覆盖)
    let where: Record<string, unknown> = filters;
    if (actor && actor.role !== UserRole.SYS_ADMIN && actor.role !== UserRole.ACADEMIC_ADMIN) {
      const scope = await buildStudentScope(this.prisma, actor);
      where = { AND: [scope, filters] };
    }
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where: where as any }),
      this.prisma.user.findMany({
        where: where as any,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'desc' },
        include: {
          department: { select: { id: true, name: true } },
          major: { select: { id: true, name: true } },
          class: { select: { id: true, name: true } },
        },
      }),
    ]);
    const sanitized = items.map((u) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...rest } = u;
      return rest;
    });
    return { total, page, pageSize, items: sanitized };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        major: true,
        class: true,
        studentProfile: true,
      },
    });
    if (!user) throw new NotFoundException('用户不存在');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async update(id: number, dto: UpdateUserDto, operatorId: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role) data.role = dto.role;
    if (dto.majorId !== undefined) data.majorId = dto.majorId;
    if (dto.classId !== undefined) data.classId = dto.classId;
    if (dto.status) data.status = dto.status;
    if (dto.resetPassword) {
      const newPwd = user.username + '@2026';
      data.passwordHash = await bcrypt.hash(newPwd, 10);
    }
    const updated = await this.prisma.user.update({ where: { id }, data });
    await this.opLog.record(operatorId, 'update_user', `user:${id}`, dto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = updated;
    return rest;
  }

  async remove(id: number, operatorId: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.role === UserRole.SYS_ADMIN) {
      throw new BadRequestException('系统管理员账号不可删除');
    }
    // 软删除:改为 DISABLED,保留数据完整性
    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.DISABLED },
    });
    await this.opLog.record(operatorId, 'disable_user', `user:${id}`, {
      username: user.username,
    });
    return { ok: true };
  }

  /**
   * 批量导入:对接学院学籍系统后,前端上传 Excel 经解析后调用。
   * 这里直接接收 JSON 数组,前端可使用 exceljs 解析 .xlsx 后调用本接口。
   */
  async batchImport(dto: BatchImportDto, operatorId: number) {
    const results: Array<{ username: string; ok: boolean; error?: string }> = [];
    let success = 0;
    let fail = 0;

    for (const item of dto.items) {
      try {
        const exists = await this.prisma.user.findUnique({
          where: { username: item.username },
        });
        if (exists) {
          throw new ConflictException('用户名已存在');
        }

        // 按专业/班级代码查找
        let majorId: number | undefined;
        let classId: number | undefined;
        let departmentId: number | undefined;
        if (item.majorCode) {
          const major = await this.prisma.major.findUnique({
            where: { code: item.majorCode },
          });
          if (major) {
            majorId = major.id;
            departmentId = major.departmentId;
          }
        }
        if (item.className) {
          const cls = await this.prisma.class.findFirst({
            where: { name: item.className },
          });
          if (cls) classId = cls.id;
        }

        const passwordHash = await bcrypt.hash(
          item.password ?? `${item.username}@2026`,
          10,
        );
        const created = await this.prisma.user.create({
          data: {
            username: item.username,
            name: item.name,
            role: item.role as unknown as UserRole,
            status: UserStatus.ACTIVE,
            studentNo: item.studentNo,
            staffNo: item.staffNo,
            phone: item.phone,
            passwordHash,
            majorId,
            classId,
            departmentId,
          },
        });
        if (created.role === UserRole.STUDENT) {
          await this.prisma.studentProfile.create({
            data: { userId: created.id, currentStage: 'NOT_STARTED' },
          });
          await this.prisma.progressArchive.create({
            data: { studentId: created.id },
          });
        }
        success++;
        results.push({ username: item.username, ok: true });
      } catch (e) {
        fail++;
        results.push({
          username: item.username,
          ok: false,
          error: (e as Error).message,
        });
      }
    }

    await this.prisma.batchImport.create({
      data: {
        operatorId,
        type: 'mixed',
        totalCount: dto.items.length,
        successCount: success,
        failCount: fail,
        detail: JSON.stringify({ results }),
      },
    });
    await this.opLog.record(operatorId, 'batch_import_users', 'users', {
      total: dto.items.length,
      success,
      fail,
    });
    return { total: dto.items.length, success, fail, results };
  }
}
