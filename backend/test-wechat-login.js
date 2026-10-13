/**
 * 微信小程序登录流程测试脚本
 * 由于环境无 MySQL,采用 mock 方式验证 WechatAuthService 的核心业务逻辑:
 *   1. code2Session — 模拟微信 jscode2session 接口
 *   2. getPhoneNumber — 模拟微信 getuserphonenumber 接口
 *   3. completeLogin — 验证 username = 姓名+学号,账号创建,JWT 签发
 *
 * 运行: node test-wechat-login.js
 */
require('dotenv').config();
require('reflect-metadata');
const { JwtService } = require('@nestjs/jwt');
const { ConfigService } = require('@nestjs/config');
const { WechatAuthService } = require('./dist/auth/wechat-auth.service.js');

// ============ Mock PrismaService(内存用户存储) ============
class MockPrismaService {
  constructor() {
    this.users = [];
    this.nextId = 1;
  }
  get user() {
    const self = this;
    return {
      findUnique: async ({ where }) => {
        if (where.wechatOpenId) return self.users.find((u) => u.wechatOpenId === where.wechatOpenId) || null;
        if (where.id) return self.users.find((u) => u.id === where.id) || null;
        if (where.username) return self.users.find((u) => u.username === where.username) || null;
        return null;
      },
      findFirst: async ({ where }) => {
        if (where.studentNo) return self.users.find((u) => u.studentNo === where.studentNo && u.role === 'STUDENT') || null;
        return null;
      },
      create: async ({ data }) => {
        const user = { id: self.nextId++, ...data, createdAt: new Date(), updatedAt: new Date() };
        self.users.push(user);
        return user;
      },
      update: async ({ where, data }) => {
        const idx = self.users.findIndex((u) => u.id === where.id);
        if (idx < 0) throw new Error('user not found');
        self.users[idx] = { ...self.users[idx], ...data };
        return self.users[idx];
      },
    };
  }
  get studentProfile() { return { create: async () => ({}) }; }
  get progressArchive() { return { create: async () => ({}) }; }
}

// ============ Mock OperationLogService ============
class MockOpLog {
  async record() { return true; }
}

// ============ Mock 微信 API(fetch) ============
const FAKE_OPENID = 'oABC123xyz_openid_mock';
const FAKE_SESSION_KEY = 'session_key_mock_123';
const FAKE_PHONE = '13800138000';

const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  // 1. jscode2session
  if (url.includes('jscode2session')) {
    return {
      json: async () => ({
        openid: FAKE_OPENID,
        session_key: FAKE_SESSION_KEY,
        errcode: 0,
      }),
    };
  }
  // 2. getAccessToken
  if (url.includes('cgi-bin/token')) {
    return {
      json: async () => ({ access_token: 'fake_access_token', expires_in: 7200, errcode: 0 }),
    };
  }
  // 3. getuserphonenumber
  if (url.includes('getuserphonenumber')) {
    return {
      json: async () => ({
        errcode: 0,
        phone_info: { phoneNumber: FAKE_PHONE },
      }),
    };
  }
  return originalFetch(url, options);
};

// ============ 运行测试 ============
async function runTests() {
  console.log('\n========== 微信小程序登录流程测试 ==========\n');

  const config = new ConfigService({
    WECHAT_APPID: 'wx_test_appid',
    WECHAT_SECRET: 'test_secret',
    JWT_SECRET: 'test_jwt_secret_for_testing_only',
    JWT_EXPIRES_IN: '1h',
  });

  const jwt = new JwtService({ secret: 'test_jwt_secret_for_testing_only' });
  const prisma = new MockPrismaService();
  const opLog = new MockOpLog();

  const wechatService = new WechatAuthService(prisma, config, jwt, opLog);

  let passed = 0;
  let failed = 0;

  function assert(name, condition, detail = '') {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // ---- 第一步:code2Session ----
  console.log('【第一步】wx.login code 换取 openid');
  let sessionResult;
  try {
    sessionResult = await wechatService.code2Session('mock_wx_login_code');
    assert('返回 openid', sessionResult.openid === FAKE_OPENID, `got: ${sessionResult.openid}`);
    assert('返回 sessionKey', !!sessionResult.sessionKey);
    console.log(`    openid: ${sessionResult.openid}`);
  } catch (e) {
    console.log(`  ✗ code2Session 失败: ${e.message}`);
    failed++;
    return;
  }

  // ---- 第二步:getPhoneNumber ----
  console.log('\n【第二步】获取手机号');
  let phone;
  try {
    phone = await wechatService.getPhoneNumber('mock_phone_code');
    assert('返回手机号', phone === FAKE_PHONE, `got: ${phone}`);
    console.log(`    phone: ${phone}`);
  } catch (e) {
    console.log(`  ✗ getPhoneNumber 失败: ${e.message}`);
    failed++;
  }

  // ---- 第三步:completeLogin(新用户注册) ----
  console.log('\n【第三步】补全姓名+学号,完成登录/注册');
  const testName = '张三';
  const testStudentNo = '202101001';
  const expectedUsername = `${testName}${testStudentNo}`;

  let loginResult;
  try {
    loginResult = await wechatService.completeLogin({
      openid: sessionResult.openid,
      phone,
      name: testName,
      studentNo: testStudentNo,
      nickname: '微信昵称测试',
      avatarUrl: 'https://example.com/avatar.png',
    });

    assert('返回 accessToken', !!loginResult.accessToken);
    assert('返回 user 对象', !!loginResult.user);
    assert('username = 姓名+学号', loginResult.user.username === expectedUsername, `got: ${loginResult.user.username}`);
    assert('name 正确', loginResult.user.name === testName);
    assert('studentNo 正确', loginResult.user.studentNo === testStudentNo);
    assert('phone 正确', loginResult.user.phone === phone);
    assert('角色为 STUDENT', loginResult.user.role === 'STUDENT');
    console.log(`    username: ${loginResult.user.username}`);
    console.log(`    role: ${loginResult.user.role}`);
  } catch (e) {
    console.log(`  ✗ completeLogin 失败: ${e.message}`);
    failed++;
  }

  // ---- 验证 JWT 有效 ----
  console.log('\n【验证】JWT Token 有效性');
  try {
    const payload = await jwt.verifyAsync(loginResult.accessToken);
    assert('JWT sub 为用户ID', payload.sub === loginResult.user.id);
    assert('JWT username 正确', payload.username === expectedUsername);
    assert('JWT role 为 STUDENT', payload.role === 'STUDENT');
    console.log(`    JWT payload: ${JSON.stringify(payload)}`);
  } catch (e) {
    console.log(`  ✗ JWT 验证失败: ${e.message}`);
    failed++;
  }

  // ---- 重复登录(老用户) ----
  console.log('\n【重复登录】同一微信用户再次登录');
  try {
    const loginResult2 = await wechatService.completeLogin({
      openid: sessionResult.openid,
      phone: '13900139000',
      name: '张三',
      studentNo: testStudentNo,
    });
    assert('复用已有账号(不重复创建)', loginResult2.user.id === loginResult.user.id);
    assert('更新手机号', loginResult2.user.phone === '13900139000');
    console.log(`    复用用户ID: ${loginResult2.user.id}`);
  } catch (e) {
    console.log(`  ✗ 重复登录失败: ${e.message}`);
    failed++;
  }

  // ---- 学号冲突检测 ----
  console.log('\n【安全检测】同学号被其他微信绑定');
  try {
    await wechatService.completeLogin({
      openid: 'oDIFFERENT_OPENID',
      name: '李四',
      studentNo: testStudentNo,
    });
    console.log(`  ✗ 未拦截学号冲突`);
    failed++;
  } catch (e) {
    assert('拦截学号重复绑定', e.message.includes('学号'), `got: ${e.message}`);
  }

  // ---- 空姓名/学号校验 ----
  console.log('\n【参数校验】空姓名/空学号');
  try {
    await wechatService.completeLogin({ openid: 'oX1', name: '', studentNo: '123' });
    console.log(`  ✗ 未拦截空姓名`);
    failed++;
  } catch (e) {
    assert('拦截空姓名', e.message.includes('姓名'));
  }
  try {
    await wechatService.completeLogin({ openid: 'oX2', name: '王五', studentNo: '' });
    console.log(`  ✗ 未拦截空学号`);
    failed++;
  } catch (e) {
    assert('拦截空学号', e.message.includes('学号'));
  }

  // ---- 结果统计 ----
  console.log('\n========== 测试结果 ==========');
  console.log(`通过: ${passed}, 失败: ${failed}`);
  if (failed === 0) {
    console.log('✅ 微信登录流程全部通过!');
    process.exit(0);
  } else {
    console.log('❌ 存在失败项,请检查');
    process.exit(1);
  }
}

// 需要先编译 TS -> JS
const { execSync } = require('child_process');
console.log('正在编译 TypeScript...');
try {
  execSync('npx tsc -p tsconfig.json', { cwd: __dirname, stdio: 'inherit' });
} catch (e) {
  console.error('编译失败,退出');
  process.exit(1);
}

runTests().catch((e) => {
  console.error('测试运行异常:', e);
  process.exit(1);
});
