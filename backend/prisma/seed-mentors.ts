/**
 * 导师账号初始化脚本
 * 运行: npx tsx prisma/seed-mentors.ts
 *
 * 说明:
 *  - 导师不能通过微信自助注册,须由管理员在此预置账号(姓名+工号+角色+负责专业)
 *  - 导师微信登录时,第三步选择"导师",填写姓名+工号即可绑定 openid
 *  - 已存在的工号会跳过(幂等)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MENTORS = [
  // 学院管理员:可看全部专业
  { staffNo: 'A001', name: '王院长', role: 'ACADEMIC_ADMIN', majorName: null as string | null },
  // 各专业导师
  { staffNo: 'T101', name: '李老师', role: 'MAJOR_MENTOR', majorName: '信息管理' },
  { staffNo: 'T201', name: '赵老师', role: 'MAJOR_MENTOR', majorName: '电子商务' },
  { staffNo: 'T301', name: '陈老师', role: 'MAJOR_MENTOR', majorName: '财务管理' },
  { staffNo: 'T401', name: '刘老师', role: 'MAJOR_MENTOR', majorName: '经济学' },
  { staffNo: 'T501', name: '周老师', role: 'MAJOR_MENTOR', majorName: '市场营销' },

  // ===== 新增导师名单(2026-11) =====
  // 学院不区分专业,统一不分配专业;工号为随机生成
  { staffNo: '683412', name: '邓昕才', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '512907', name: '康文峰', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '748263', name: '吕重犁', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '391685', name: '王晨曦', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '627048', name: '陈福娣', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '856321', name: '石璞', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '470592', name: '周怡', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '619834', name: '周雪', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '283756', name: '陈英葵', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '735190', name: '秦健超', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '508472', name: '王玮', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '962103', name: '张雨', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '174629', name: '崔新华', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '845016', name: '肖丽娅', role: 'MAJOR_MENTOR', majorName: null as string | null },
  { staffNo: '396258', name: '尹晓露', role: 'MAJOR_MENTOR', majorName: null as string | null },
];

async function main() {
  for (const m of MENTORS) {
    const existing = await prisma.user.findFirst({ where: { staffNo: m.staffNo } });
    if (existing) {
      console.log(`跳过(已存在): ${m.name} ${m.staffNo}`);
      continue;
    }
    await prisma.user.create({
      data: {
        staffNo: m.staffNo,
        name: m.name,
        username: m.staffNo,
        passwordHash: '',
        role: m.role,
        status: 'ACTIVE',
        majorName: m.majorName,
      },
    });
    console.log(`创建: ${m.role} ${m.name} 工号:${m.staffNo} 负责:${m.majorName ?? '全院'}`);
  }
  console.log('导师账号初始化完成');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
