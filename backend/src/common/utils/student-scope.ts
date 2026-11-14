import { PrismaService } from '../../prisma/prisma.service';

/** 可查看全部学生资料的工号(学院负责人 + 测试账号) */
export const FULL_ACCESS_MENTOR_STAFF_NOS = ['683412', '512907', '251104050021']; // 邓昕才、康文峰、测试账号(李宇泽)

/** 测试账号工号:可分别以学生端/导师端身份登录 */
export const TEST_ACCOUNT_STAFF_NO = '251104050021';

export interface ScopeActor {
  id: number;
  role: string;
  staffNo?: string | null;
}

/**
 * 学生数据可见范围的唯一入口(权限隔离)
 * - 系统/学院管理员: 全部学生
 * - 白名单工号(邓昕才/康文峰/测试账号): 全部学生
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

  // 白名单工号不看角色,一律可见全部学生(测试账号用学生身份登录导师端时同样生效)
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
