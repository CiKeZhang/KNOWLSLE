import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  ListUsersDto,
  BatchImportDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';

@ApiTags('用户管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN, UserRole.COUNSELOR, UserRole.MAJOR_MENTOR)
  @ApiOperation({ summary: '用户列表(按权限可见范围)' })
  list(@Query() q: ListUsersDto) {
    return this.users.list(q);
  }

  @Get(':id')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '用户详情' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.users.findOne(id);
  }

  @Post()
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '创建用户(可对接学院学籍系统单条补录)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '更新用户' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '停用用户(软删除,保留数据完整性)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.users.remove(id, user.id);
  }

  @Post('batch-import')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '批量导入用户(前端解析 Excel 后调用)' })
  batchImport(@Body() dto: BatchImportDto, @CurrentUser() user: AuthUser) {
    return this.users.batchImport(dto, user.id);
  }
}
