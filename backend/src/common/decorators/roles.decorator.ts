import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums';

export const ROLES_KEY = 'roles';

/**
 * 角色守卫元数据。传入允许访问的角色列表。
 * @example @Roles(UserRole.COUNSELOR, UserRole.ACADEMIC_ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
