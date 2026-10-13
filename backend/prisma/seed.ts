import { PrismaClient, UserRole, UserStatus, StudyStage } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * 种子数据:
 * 1. 初始系统管理员(密码: admin@2026,生产环境请务必登录后修改)
 * 2. 演示部门/专业/班级
 * 3. 默认打卡规则
 * 4. 考研关键节点提醒(2026 年度)
 * 5. 示例院校与招生专业(供 AI 推荐与列表使用,学院上线后可补充)
 */
async function main() {
  console.log('🌱 开始种子数据初始化...');

  // ---------- 1. 系统管理员 ----------
  const adminPwd = await bcrypt.hash('admin@2026', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: '系统管理员',
      staffNo: 'SYS001',
      passwordHash: adminPwd,
      role: UserRole.SYS_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`  ✅ 管理员: ${admin.username} (默认密码: admin@2026)`);

  // ---------- 2. 部门 / 专业 / 班级 ----------
  const dept = await prisma.department.upsert({
    where: { code: 'SEM' },
    update: {},
    create: { name: '经济管理学院', code: 'SEM' },
  });
  const majorAcc = await prisma.major.upsert({
    where: { code: 'ACCT' },
    update: {},
    create: { name: '会计学', code: 'ACCT', departmentId: dept.id },
  });
  const majorFin = await prisma.major.upsert({
    where: { code: 'FIN' },
    update: {},
    create: { name: '金融学', code: 'FIN', departmentId: dept.id },
  });
  const majorEcon = await prisma.major.upsert({
    where: { code: 'ECON' },
    update: {},
    create: { name: '经济学', code: 'ECON', departmentId: dept.id },
  });
  const cls = await prisma.class.upsert({
    where: { id: 1 },
    update: { departmentId: dept.id },
    create: {
      name: '会计2101',
      grade: '2021',
      majorId: majorAcc.id,
      departmentId: dept.id,
    },
  });

  // ---------- 3. 辅导员 + 专业导师 ----------
  const counselorPwd = await bcrypt.hash('counselor@2026', 10);
  const counselor = await prisma.user.upsert({
    where: { username: 'counselor1' },
    update: {},
    create: {
      username: 'counselor1',
      name: '王辅导员',
      staffNo: 'T20201',
      passwordHash: counselorPwd,
      role: UserRole.COUNSELOR,
      status: UserStatus.ACTIVE,
      departmentId: dept.id,
    },
  });
  await prisma.class.update({
    where: { id: cls.id },
    data: { counselorId: counselor.id },
  });

  const mentorPwd = await bcrypt.hash('mentor@2026', 10);
  await prisma.user.upsert({
    where: { username: 'mentor1' },
    update: {},
    create: {
      username: 'mentor1',
      name: '李导师',
      staffNo: 'T20301',
      passwordHash: mentorPwd,
      role: UserRole.MAJOR_MENTOR,
      status: UserStatus.ACTIVE,
      departmentId: dept.id,
      majorId: majorAcc.id,
    },
  });

  const academicAdminPwd = await bcrypt.hash('academic@2026', 10);
  await prisma.user.upsert({
    where: { username: 'academic' },
    update: {},
    create: {
      username: 'academic',
      name: '张管理员',
      staffNo: 'A001',
      passwordHash: academicAdminPwd,
      role: UserRole.ACADEMIC_ADMIN,
      status: UserStatus.ACTIVE,
      departmentId: dept.id,
    },
  });

  // ---------- 4. 示例学生 ----------
  const studentPwd = await bcrypt.hash('student@2026', 10);
  const student = await prisma.user.upsert({
    where: { username: '20210001' },
    update: {},
    create: {
      username: '20210001',
      studentNo: '20210001',
      name: '陈同学',
      passwordHash: studentPwd,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      departmentId: dept.id,
      majorId: majorAcc.id,
      classId: cls.id,
    },
  });
  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {},
    create: {
      userId: student.id,
      undergraduateMajor: '会计学',
      gpa: 3.5,
      majorRank: '8/45',
      region: '北京',
      schoolTierPref: 'TWO_ONE_ONE',
      strongSubjects: ['政治', '英语'],
      weakSubjects: ['数学三'],
      careerIntention: '金融行业从业',
      enterYear: 2021,
      currentStage: StudyStage.BASIC,
      remainingMonths: 6,
    },
  });
  await prisma.progressArchive.upsert({
    where: { studentId: student.id },
    update: {},
    create: {
      studentId: student.id,
      targetSchoolName: '中国人民大学',
      targetMajor: '会计学',
      publicCourseProgress: 35,
      majorCourseProgress: 20,
    },
  });

  // ---------- 5. 默认打卡规则 ----------
  await prisma.checkInRule.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  // ---------- 6. 考研关键节点(2026 年度) ----------
  const nodes = [
    { nodeKey: 'pre_register', name: '预报名', remindAt: new Date('2026-10-05T09:00:00') },
    { nodeKey: 'register', name: '正式报名', remindAt: new Date('2026-10-15T09:00:00') },
    { nodeKey: 'confirm', name: '现场/网上确认', remindAt: new Date('2026-11-01T09:00:00') },
    { nodeKey: 'exam', name: '初试', remindAt: new Date('2026-12-19T09:00:00') },
    { nodeKey: 'score_publish', name: '成绩公布', remindAt: new Date('2027-02-15T09:00:00') },
    { nodeKey: 'national_line', name: '国家线发布', remindAt: new Date('2027-03-15T09:00:00') },
    { nodeKey: 'reexam', name: '复试', remindAt: new Date('2027-03-20T09:00:00') },
    { nodeKey: 'adjust', name: '调剂', remindAt: new Date('2027-04-01T09:00:00') },
  ];
  for (const n of nodes) {
    await prisma.keyNodeReminder.upsert({
      where: { nodeKey: n.nodeKey },
      update: { remindAt: n.remindAt },
      create: { ...n, enabled: true },
    });
  }

  // ---------- 7. 示例院校与招生专业 ----------
  const schools = [
    { name: '中国人民大学', tier: 'NINE_EIGHT_FIVE', region: '华北', province: '北京', city: '北京', is985: true, is211: true, isDoubleFirst: true, priorityWeight: 1.2 },
    { name: '中央财经大学', tier: 'TWO_ONE_ONE', region: '华北', province: '北京', city: '北京', is985: false, is211: true, isDoubleFirst: true, priorityWeight: 1.1 },
    { name: '上海财经大学', tier: 'TWO_ONE_ONE', region: '华东', province: '上海', city: '上海', is985: false, is211: true, isDoubleFirst: true, priorityWeight: 1.1 },
    { name: '西南财经大学', tier: 'DOUBLE_FIRST', region: '西南', province: '四川', city: '成都', is985: false, is211: true, isDoubleFirst: true, priorityWeight: 1 },
    { name: '东北财经大学', tier: 'DOUBLE_NON', region: '东北', province: '辽宁', city: '大连', is985: false, is211: false, isDoubleFirst: false, priorityWeight: 0.9 },
    { name: '本校(示例)', tier: 'DOUBLE_NON', region: '本地', province: '本地', city: '本地', is985: false, is211: false, isDoubleFirst: false, priorityWeight: 1.5 },
  ];
  for (const s of schools) {
    await prisma.school.upsert({
      where: { name: s.name },
      update: s,
      create: s,
    });
  }

  const samplePrograms = [
    { schoolName: '中国人民大学', majorName: '会计学', enrollCount2025: 35, reexamLine2025: 380, examSubjects: ['101思想政治理论', '201英语一', '303数学三', '823管理学'] },
    { schoolName: '中央财经大学', majorName: '金融学', enrollCount2025: 28, reexamLine2025: 360, examSubjects: ['101思想政治理论', '201英语一', '303数学三', '801经济学'] },
    { schoolName: '上海财经大学', majorName: '会计学', enrollCount2025: 25, reexamLine2025: 375, examSubjects: ['101思想政治理论', '201英语一', '303数学三', '801会计学'] },
  ];
  for (const p of samplePrograms) {
    const school = await prisma.school.findUnique({ where: { name: p.schoolName } });
    if (!school) continue;
    await prisma.majorProgram.upsert({
      where: { id: 0 }, // 占位,实际 create
      update: {},
      create: {
        schoolId: school.id,
        majorName: p.majorName,
        enrollCount2025: p.enrollCount2025,
        reexamLine2025: p.reexamLine2025,
        examSubjects: p.examSubjects,
      },
    }).catch(() => undefined);
  }

  // ---------- 8. 默认系统配置 ----------
  await prisma.systemConfig.upsert({
    where: { key: 'alert_rules' },
    update: {},
    create: {
      key: 'alert_rules',
      value: {
        checkinMissingWeeks: 2,
        progressStaleWeeks: 3,
        loginInactiveDays: 15,
        scoreBelowNationalLine: true,
      },
      description: '预警规则配置',
    },
  });

  console.log('✅ 种子数据初始化完成');
  console.log('   默认账号(密码见各 @2026 后缀):');
  console.log('   - admin / admin@2026');
  console.log('   - academic / academic@2026');
  console.log('   - counselor1 / counselor@2026');
  console.log('   - mentor1 / mentor@2026');
  console.log('   - 20210001 / student@2026');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
