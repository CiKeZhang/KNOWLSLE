import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '../common/enums';
import { Logger } from '@nestjs/common';
import { OperationLogService } from '../common/services/operation-log.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly opLog: OperationLogService,
  ) {}

  async login(username: string, password: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`账号状态不可用:${user.status}`);
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 更新登录时间
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await this.jwt.signAsync(
      { sub: user.id, username: user.username, role: user.role },
      {
        secret: this.config.get<string>('JWT_SECRET', 'please_change_jwt_secret_in_production'),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '12h'),
      },
    );

    this.opLog.record(user.id, 'login', 'auth', { ip }).catch(() => undefined);

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        studentNo: user.studentNo,
        staffNo: user.staffNo,
        departmentId: user.departmentId,
        majorId: user.majorId,
        classId: user.classId,
      },
    };
  }

  /** 修改密码 */
  async changePassword(userId: number, oldPwd: string, newPwd: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('用户不存在');
    const ok = await bcrypt.compare(oldPwd, user.passwordHash);
    if (!ok) throw new BadRequestException('原密码错误');
    if (newPwd.length < 6) throw new BadRequestException('新密码至少 6 位');
    const passwordHash = await bcrypt.hash(newPwd, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  /** 获取当前用户档案(含学生扩展信息) */
  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        major: true,
        class: true,
        studentProfile: true,
      },
    });
    if (!user) throw new BadRequestException('用户不存在');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }

  /** 初始化首个管理员(若系统中无任何 SYS_ADMIN 则允许) */
  async bootstrapAdmin(username: string, password: string, name: string) {
    const exists = await this.prisma.user.findFirst({
      where: { role: UserRole.SYS_ADMIN },
    });
    if (exists) {
      throw new ConflictException('管理员已存在,禁止重复初始化');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await this.prisma.user.create({
      data: {
        username,
        name,
        passwordHash,
        role: UserRole.SYS_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    this.logger.log(`✅ 初始管理员已创建: ${admin.username}`);
    return { id: admin.id, username: admin.username };
  }
}
