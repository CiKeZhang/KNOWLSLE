import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { TEST_ACCOUNT_STAFF_NO } from '../../common/utils/student-scope';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'please_change_jwt_secret_in_production'),
    });
  }

  /**
   * JWT payload 中已含 userId / role,这里校验用户状态并补充上下文字段,
   * 用于权限隔离(导师只能看管辖范围的学生)。
   */
  async validate(payload: {
    sub: number;
    username: string;
    role: string;
    actAs?: string;
  }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        status: true,
        staffNo: true,
        departmentId: true,
        majorId: true,
        classId: true,
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('账号不可用或已停用');
    }

    // 测试账号(李宇泽)可用「导师端模式」令牌访问导师接口,不影响其学生端令牌
    const isTestAccount =
      user.staffNo === TEST_ACCOUNT_STAFF_NO || user.username === TEST_ACCOUNT_STAFF_NO;
    const effectiveRole = isTestAccount && payload.actAs === 'MENTOR' ? 'MAJOR_MENTOR' : user.role;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: effectiveRole,
      staffNo: user.staffNo ?? undefined,
      departmentId: user.departmentId ?? undefined,
      majorId: user.majorId ?? undefined,
      classId: user.classId ?? undefined,
    };
  }
}
