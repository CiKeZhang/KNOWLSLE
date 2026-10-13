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
