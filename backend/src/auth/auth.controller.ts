import { Body, Controller, Post, Get, UseGuards, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { WechatAuthService } from './wechat-auth.service';
import { LoginDto, ChangePasswordDto, BootstrapAdminDto, TestLoginDto } from './dto/auth.dto';
import { WechatLoginDto, WechatPhoneDto, WechatCompleteDto } from './dto/wechat.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('认证')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly wechat: WechatAuthService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: '用户登录(账号密码,导师/管理员使用)' })
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.login(dto.username, dto.password, req?.ip);
  }

  // ============ 微信小程序登录(学生端) ============

  @Public()
  @Post('wechat/login')
  @ApiOperation({ summary: '微信小程序-第一步:wx.login 换取一次性登录票据' })
  async wechatLogin(@Body() dto: WechatLoginDto) {
    // openid 不再交给客户端:签发短时效票据,第三步由服务端校验后取回 openid,
    // 避免客户端自传 openid 冒充任意账号(含院长)完成绑定登录。
    const result = await this.wechat.code2Session(dto.code);
    return { loginTicket: await this.wechat.issueLoginTicket(result.openid) };
  }

  @Public()
  @Post('wechat/phone')
  @ApiOperation({ summary: '微信小程序-第二步:获取手机号票据' })
  async wechatPhone(@Body() dto: WechatPhoneDto) {
    const phone = await this.wechat.getPhoneNumber(dto.code);
    return { phoneTicket: await this.wechat.issuePhoneTicket(phone), phoneNumber: phone };
  }

  @Public()
  @Post('wechat/complete')
  @ApiOperation({ summary: '微信小程序-第三步:补全姓名+学号,完成登录/注册' })
  wechatComplete(@Body() dto: WechatCompleteDto) {
    return this.wechat.completeLogin(dto);
  }

  @Public()
  @Post('test-login')
  @ApiOperation({ summary: '测试登录:凭口令切换为任意学号/工号账号(不绑定微信)' })
  testLogin(@Body() dto: TestLoginDto) {
    return this.auth.testLogin(dto.account, dto.secret, dto.asMentor === true);
  }

  @Public()
  @Post('bootstrap-admin')
  @ApiOperation({ summary: '初始化系统首个管理员(仅当无管理员时可用,用于首次部署)' })
  bootstrap(@Body() dto: BootstrapAdminDto, @Headers('x-bootstrap-token') token?: string) {
    return this.auth.bootstrapAdmin(dto.username, dto.password, dto.name, token);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: '获取当前用户档案' })
  profile(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: '修改密码' })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, dto.oldPassword, dto.newPassword);
  }
}
