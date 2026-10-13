import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '../common/enums';
import { MAJORS } from '../common/constants';
import { OperationLogService } from '../common/services/operation-log.service';

/**
 * 微信小程序认证服务
 * 三段式登录流程:
 *   1. wx.login(code) → 后端换 openid + session_key
 *   2. <button open-type="getPhoneNumber"> → 后端换手机号
 *   3. 学生补全真实姓名+学号 → 以"姓名+学号"为 username 创建/更新账号,签发 JWT
 *
 * 设计要点(参考经验):
 * - 前端不输入 username,username 由后端拼接为 "真实姓名+学号"
 * - 学生用户 passwordHash 可为空(仅微信登录),web 端补全密码的逻辑不在学生端
 * - 同手机号已有记录则复用并绑定 openid
 */
@Injectable()
export class WechatAuthService {
  private readonly logger = new Logger(WechatAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly opLog: OperationLogService,
  ) {}

  /** 第一步:用 wx.login code 换取 openid + session_key */
  async code2Session(code: string): Promise<{ openid: string; sessionKey: string; unionid?: string }> {
    const appId = this.config.get<string>('WECHAT_APPID');
    const secret = this.config.get<string>('WECHAT_SECRET');

    // 开发模式:未配置真实密钥时,返回 mock openid 方便本地测试
    if (!appId || !secret || secret === 'your_app_secret_here') {
      this.logger.warn(`⚠️ 开发模式:微信密钥未配置,使用 mock openid. code=${code}`);
      // 用 code 生成稳定的 mock openid
      const mockOpenid = 'dev_' + this.hashCode(code).toString(36).padStart(10, '0');
      return {
        openid: mockOpenid,
        sessionKey: 'dev_session_key_' + Date.now(),
      };
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json() as any;
      if (data.errcode && data.errcode !== 0) {
        throw new BadRequestException(`微信登录失败: ${data.errmsg ?? data.errcode}`);
      }
      return {
        openid: data.openid,
        sessionKey: data.session_key,
        unionid: data.unionid,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** 第二步:用 getPhoneNumber code 换取手机号 */
  async getPhoneNumber(code: string): Promise<string> {
    const appId = this.config.get<string>('WECHAT_APPID');
    const secret = this.config.get<string>('WECHAT_SECRET');

    // 开发模式:未配置真实密钥时,返回 mock 手机号
    if (!appId || !secret || secret === 'your_app_secret_here') {
      this.logger.warn('⚠️ 开发模式:返回 mock 手机号');
      return '1380000' + (1000 + this.hashCode(code) % 9000);
    }

    // 先获取 access_token
    const accessToken = await this.getAccessToken(appId, secret);

    const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        signal: controller.signal,
      });
      const data = await res.json() as any;
      if (data.errcode && data.errcode !== 0) {
        throw new BadRequestException(`获取手机号失败: ${data.errmsg ?? data.errcode}`);
      }
      return data.phone_info.phoneNumber as string;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 第三步:补全身份信息(学生:姓名+学号+专业 / 导师:姓名+工号),完成登录/注册,签发 JWT */
  async completeLogin(params: {
    openid: string;
    phone?: string;
    name: string;
    studentNo: string;
    identity?: 'student' | 'mentor';
    majorName?: string;
    nickname?: string;
    avatarUrl?: string;
  }): Promise<{ accessToken: string; user: any }> {
    const { openid, phone, name, studentNo, nickname, avatarUrl } = params;
    const identity = params.identity ?? 'student';

    // 校验
    if (!name.trim()) throw new BadRequestException('请填写真实姓名');
    if (!studentNo.trim()) throw new BadRequestException(identity === 'mentor' ? '请填写工号' : '请填写学号');

    if (identity === 'mentor') {
      return this.completeMentorLogin({ openid, phone, name, staffNo: studentNo.trim(), nickname, avatarUrl });
    }
    return this.completeStudentLogin({
      openid, phone, name: name.trim(), studentNo: studentNo.trim(),
      majorName: params.majorName, nickname, avatarUrl,
    });
  }

  /** 学生注册/登录:姓名+学号+专业,username = 姓名+学号 */
  private async completeStudentLogin(params: {
    openid: string;
    phone?: string;
    name: string;
    studentNo: string;
    majorName?: string;
    nickname?: string;
    avatarUrl?: string;
  }): Promise<{ accessToken: string; user: any }> {
    const { openid, phone, name, studentNo, majorName, nickname, avatarUrl } = params;

    if (!majorName || !MAJORS.includes(majorName as any)) {
      throw new BadRequestException('请选择专业');
    }

    // username = 真实姓名 + 学号
    const username = `${name}${studentNo}`;

    // 查找是否已存在该 openid 的用户(老用户回来)
    let user = await this.prisma.user.findUnique({ where: { wechatOpenId: openid } });

    if (user) {
      // 如果该微信已绑定导师/管理员账号,不允许再以学生身份登录
      if (user.role !== UserRole.STUDENT) {
        throw new BadRequestException('该微信已绑定导师账号,请使用导师身份登录或联系管理员');
      }
      // 已注册,更新资料并登录
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          studentNo,
          username,
          majorName,
          phone: phone ?? user.phone,
          wechatNickname: nickname ?? user.wechatNickname,
          avatarUrl: avatarUrl ?? user.avatarUrl,
          lastLoginAt: new Date(),
        },
      });
    } else {
      // 新用户:检查学号是否已被其他 openid 占用
      const existingByStudentNo = await this.prisma.user.findFirst({
        where: { studentNo, role: UserRole.STUDENT },
      });
      if (existingByStudentNo && existingByStudentNo.wechatOpenId && existingByStudentNo.wechatOpenId !== openid) {
        throw new BadRequestException('该学号已被其他微信账号绑定,请联系管理员');
      }

      // 创建学生用户(passwordHash 为空字符串,表示仅微信登录)
      user = await this.prisma.user.create({
        data: {
          username,
          name,
          studentNo,
          majorName,
          phone,
          passwordHash: '', // 微信登录用户无密码
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
          wechatOpenId: openid,
          wechatNickname: nickname,
          avatarUrl,
          // 初始化学生档案
          studentProfile: { create: {} },
          progressArchive: { create: {} },
        },
      });
    }

    return this.issueToken(user, openid);
  }

  /**
   * 导师登录:导师账号须由管理员预先在后台创建(含工号 staffNo、角色、负责专业),
   * 导师用微信补全 姓名+工号 后绑定 openid。不允许微信自助注册导师账号。
   */
  private async completeMentorLogin(params: {
    openid: string;
    phone?: string;
    name: string;
    staffNo: string;
    nickname?: string;
    avatarUrl?: string;
  }): Promise<{ accessToken: string; user: any }> {
    const { openid, phone, name, staffNo, nickname, avatarUrl } = params;

    // 该微信已绑定过账号
    const bound = await this.prisma.user.findUnique({ where: { wechatOpenId: openid } });
    if (bound && bound.role === UserRole.STUDENT) {
      throw new BadRequestException('该微信已绑定学生账号,请使用导师微信或联系管理员');
    }

    // 按工号查找预置导师账号
    const mentor = await this.prisma.user.findFirst({
      where: { staffNo, role: { in: [UserRole.MAJOR_MENTOR, UserRole.COUNSELOR, UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN] } },
    });
    if (!mentor) {
      throw new BadRequestException('工号不存在或未开通导师权限,请联系学院管理员');
    }
    if (mentor.wechatOpenId && mentor.wechatOpenId !== openid) {
      throw new BadRequestException('该工号已绑定其他微信账号,请联系管理员');
    }
    if (name.trim() !== mentor.name) {
      throw new BadRequestException(`姓名与工号不匹配(应为:${mentor.name})`);
    }

    const user = await this.prisma.user.update({
      where: { id: mentor.id },
      data: {
        phone: phone ?? mentor.phone,
        wechatOpenId: openid,
        wechatNickname: nickname,
        avatarUrl: avatarUrl,
        lastLoginAt: new Date(),
      },
    });

    return this.issueToken(user, openid);
  }

  /** 签发 JWT 并返回用户信息 */
  private async issueToken(user: any, openid: string): Promise<{ accessToken: string; user: any }> {
    const token = await this.jwt.signAsync(
      { sub: user.id, username: user.username, role: user.role },
      {
        secret: this.config.get<string>('JWT_SECRET', 'please_change_jwt_secret_in_production'),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '7d'),
      },
    );

    await this.opLog.record(user.id, 'wechat_login', 'auth', { openid: openid.slice(0, 8) + '***' }).catch(() => undefined);

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        studentNo: user.studentNo,
        staffNo: user.staffNo,
        majorName: user.majorName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /** 获取 access_token(带缓存) */
  private accessTokenCache: { token: string; expiresAt: number } | null = null;
  private async getAccessToken(appId: string, secret: string): Promise<string> {
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > Date.now()) {
      return this.accessTokenCache.token;
    }
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json() as any;
      if (data.errcode && data.errcode !== 0) {
        throw new BadRequestException(`获取 access_token 失败: ${data.errmsg}`);
      }
      this.accessTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 300) * 1000,
      };
      return data.access_token;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 简单字符串哈希(用于开发模式生成稳定 mock id) */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
