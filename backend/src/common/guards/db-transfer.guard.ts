import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UserRole } from '../enums';

/** 恒定时间比较,避免通过响应耗时爆破口令 */
function safeEqual(a?: unknown, b?: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * 数据库导出/导入接口的专用守卫。
 *
 * 两条互斥的授权通道:
 *  1. 运维通道:请求头 x-db-transfer-secret 命中环境变量 DB_TRANSFER_SECRET
 *     (必须显式配置;代码里不再内置任何默认口令,未配置即视为关闭);
 *  2. 管理员通道:正常的 Bearer JWT,且角色必须是 SYS_ADMIN。
 *
 * 旧实现是 @Public() + 源码里写死的默认口令,任何人都能拉走整库,这里彻底移除。
 */
@Injectable()
export class DbTransferGuard extends AuthGuard('jwt') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    if (this.config.get<string>('DISABLE_DB_TRANSFER') === 'true') {
      throw new ForbiddenException('数据库传输接口已禁用');
    }

    const req = ctx.switchToHttp().getRequest<any>();
    const expected = this.config.get<string>('DB_TRANSFER_SECRET');
    const provided = req?.headers?.['x-db-transfer-secret'];
    if (expected && safeEqual(provided, expected)) {
      req.user = {
        id: 0,
        username: 'db-transfer',
        name: '运维通道',
        role: UserRole.SYS_ADMIN,
      };
      return true;
    }

    // 未提供运维口令 → 走标准 JWT 校验
    return super.canActivate(ctx);
  }

  handleRequest(err: any, user: any, _info: any, _ctx: ExecutionContext): any {
    if (err || !user) {
      throw err || new UnauthorizedException('需要有效的系统管理员令牌或运维口令');
    }
    if (user.role !== UserRole.SYS_ADMIN) {
      throw new ForbiddenException('仅系统管理员可执行数据库传输');
    }
    return user;
  }
}
