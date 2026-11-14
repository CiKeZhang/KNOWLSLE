import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 可查看全部学生资料的工号(唯一例外:两位院长)。
 * 其余导师一律只能看自己名下(mentorId)的学生。
 * 测试账号不再享有全量可见权;需要看全院数据时,用测试登录切换到院长账号即可。
 */
export const FULL_ACCESS_MENTOR_STAFF_NOS = ['683412', '512907']; // 邓昕才院长、康文峰院长

/** 测试账号工号:可分别以学生端/导师端身份登录(与数据权限无关) */
export const TEST_ACCOUNT_STAFF_NO = '251104050021';

export interface ScopeActor {
  id: number;
  role: string;
  staffNo?: string | null;
}

/**
 * 学生数据可见范围的唯一入口(权限隔离)
 * - 系统/学院管理员: 全部学生
 * - 邓昕才院长(683412)/康文峰院长(512907): 全部学生(唯一例外)
 * - 辅导员: 本人所带班级的学生
 * - 其他导师: 学生主动选择其为导师的(mentorId), 未选择则看不到
 * - 其余角色/异常: 空集(fail-closed), 绝不退化为全量
 */
export async function buildStudentScope(
  prisma: PrismaService,
  actor: ScopeActor,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const base: Record<string, unknown> = { role: 'STUDENT', status: 'ACTIVE' };

  // 两位院长不看角色,一律可见全部学生
  let staffNo = actor.staffNo ?? undefined;
  if (!staffNo && actor.id) {
    const me = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { staffNo: true },
    });
    staffNo = me?.staffNo ?? undefined;
  }
  if (staffNo && FULL_ACCESS_MENTOR_STAFF_NOS.includes(staffNo)) {
    return { ...base, ...extra };
  }

  switch (actor.role) {
    case 'SYS_ADMIN':
    case 'ACADEMIC_ADMIN':
      return { ...base, ...extra };

    case 'COUNSELOR':
      return { ...base, class: { counselorId: actor.id }, ...extra };

    case 'MAJOR_MENTOR': {
      if (!actor.id) return { ...base, id: -1, ...extra };
      return { ...base, mentorId: actor.id, ...extra };
    }

    default:
      return { ...base, id: -1, ...extra };
  }
}

/** 当前登录人可见的学生 id 集合(用于关注列表、批量操作的边界检查) */
export async function listVisibleStudentIds(
  prisma: PrismaService,
  actor: ScopeActor,
): Promise<number[]> {
  const scope = await buildStudentScope(prisma, actor);
  const rows = await prisma.user.findMany({
    where: scope as any,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * 校验某个学生是否在当前登录人的可见范围内。
 * 所有「按 studentId 查详情 / 写操作」都必须经过这里,
 * 否则导师可以靠猜测 id 读取或操作其他导师名下的学生(列表页再严也没用)。
 */
export async function assertStudentVisible(
  prisma: PrismaService,
  actor: ScopeActor,
  studentId: number,
): Promise<void> {
  const scope = await buildStudentScope(prisma, actor);
  const count = await prisma.user.count({
    where: { ...scope, id: studentId } as any,
  });
  if (count === 0) {
    throw new ForbiddenException('无权访问该学生的数据');
  }
}
