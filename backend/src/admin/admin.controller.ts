import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole, SchoolTier } from '../common/enums';
import { OperationLogService } from '../common/services/operation-log.service';

@ApiTags('后台管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly opLog: OperationLogService,
  ) {}

  // ---------- 打卡规则 ----------
  @Get('checkin-rule')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '查看打卡规则' })
  getCheckInRule() {
    return this.admin.getCheckInRule();
  }

  @Patch('checkin-rule')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '更新打卡规则(周期/起止/提醒/补卡/必填项)' })
  updateCheckInRule(@Body() data: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    return this.admin.updateCheckInRule(data, user.id);
  }

  // ---------- 院校库 ----------
  @Get('schools')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN, UserRole.MAJOR_MENTOR, UserRole.COUNSELOR)
  @ApiOperation({ summary: '院校列表(支持关键字/层次/地区筛选)' })
  listSchools(
    @Query('keyword') keyword?: string,
    @Query('tier') tier?: SchoolTier,
    @Query('region') region?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listSchools({
      keyword,
      tier,
      region,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Post('schools')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '新增院校' })
  createSchool(@Body() data: any, @CurrentUser() user: AuthUser) {
    return this.admin.createSchool(data, user.id);
  }

  @Patch('schools/:id')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '更新院校(可设置优先推荐权重)' })
  updateSchool(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Record<string, unknown>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.updateSchool(id, data, user.id);
  }

  @Get('schools/:id/programs')
  @ApiOperation({ summary: '某院校招生专业列表' })
  listPrograms(@Param('id', ParseIntPipe) id: number) {
    return this.admin.listPrograms(id);
  }

  @Post('schools/:id/programs')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '新增招生专业(含近3年报录比/分数线)' })
  createProgram(@Param('id', ParseIntPipe) id: number, @Body() data: any, @CurrentUser() user: AuthUser) {
    return this.admin.createProgram({ ...data, schoolId: id }, user.id);
  }

  @Patch('programs/:id')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '更新招生专业' })
  updateProgram(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Record<string, unknown>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.updateProgram(id, data, user.id);
  }

  // ---------- 系统配置 ----------
  @Get('configs')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '系统配置列表' })
  listConfigs() {
    return this.admin.listConfigs();
  }

  @Get('configs/:key')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '查看某配置项' })
  getConfig(@Param('key') key: string) {
    return this.admin.getConfig(key);
  }

  @Patch('configs/:key')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '更新配置项(预警规则/提醒节点等)' })
  updateConfig(
    @Param('key') key: string,
    @Body('value') value: any,
    @Body('description') description: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.updateConfig(key, value, description, user.id);
  }

  // ---------- 关键节点 ----------
  @Get('key-nodes')
  @ApiOperation({ summary: '考研关键节点列表' })
  listKeyNodes() {
    return this.admin.listKeyNodes();
  }

  @Patch('key-nodes/:id')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '更新关键节点(时间/启用/描述)' })
  updateKeyNode(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.updateKeyNode(id, data, user.id);
  }

  // ---------- 组织机构 ----------
  @Get('departments')
  @ApiOperation({ summary: '院系列表' })
  listDepartments() {
    return this.admin.listDepartments();
  }

  @Post('departments')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '新增院系' })
  createDepartment(@Body() data: any, @CurrentUser() user: AuthUser) {
    return this.admin.createDepartment(data.name, data.code, data.parentId, user.id);
  }

  @Get('majors')
  @ApiOperation({ summary: '专业列表' })
  listMajors(@Query('departmentId') departmentId?: string) {
    return this.admin.listMajors(departmentId ? Number(departmentId) : undefined);
  }

  @Post('majors')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '新增专业' })
  createMajor(@Body() data: any, @CurrentUser() user: AuthUser) {
    return this.admin.createMajor(data.name, data.code, data.departmentId, user.id);
  }

  @Get('classes')
  @ApiOperation({ summary: '班级列表' })
  listClasses(@Query('majorId') majorId?: string, @Query('departmentId') departmentId?: string) {
    return this.admin.listClasses(
      majorId ? Number(majorId) : undefined,
      departmentId ? Number(departmentId) : undefined,
    );
  }

  @Post('classes')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '新增班级' })
  createClass(@Body() data: any, @CurrentUser() user: AuthUser) {
    return this.admin.createClass(data, user.id);
  }

  // ---------- 操作日志 ----------
  @Get('operation-logs')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '操作日志查询(全量留痕,可追溯)' })
  listOperationLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.opLog.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      userId: userId ? Number(userId) : undefined,
      action,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
    });
  }
}
