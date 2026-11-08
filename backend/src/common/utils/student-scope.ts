import { PrismaService } from '../../prisma/prisma.service';

/** 可查看全部学生资料的导师工号(学院层面负责人) */
export const FULL_ACCESS_MENTOR_STAFF_NOS = ['683412', '512907']; // 邓昕才、康文峰

export interface ScopeActor {
  id: number;
  role: string;
  staffNo?: string | null;
}

/**
 * 学生数据可见范围的唯一入口(权限隔离)
 * - 系统/学院管理员: 全部学生
 * - 白名单导师(邓昕才/康文峰): 全部学生
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

  switch (actor.role) {
    case 'SYS_ADMIN':
    case 'ACADEMIC_ADMIN':
      return { ...base, ...extra };

    case 'COUNSELOR':
      return { ...base, class: { counselorId: actor.id }, ...extra };

    case 'MAJOR_MENTOR': {
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
      if (!actor.id) return { ...base, id: -1, ...extra };
      return { ...base, mentorId: actor.id, ...extra };
    }

    default:
      return { ...base, id: -1, ...extra };
  }
}
