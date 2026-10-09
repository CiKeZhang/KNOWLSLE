import { IsString, IsOptional, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MAJORS } from '../../common/constants';

/** 第一步:wx.login 获取 code,后端换取 openid */
export class WechatLoginDto {
  @ApiProperty({ description: 'wx.login 返回的 code' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

/** 第二步:获取手机号(通过 button open-type="getPhoneNumber") */
export class WechatPhoneDto {
  @ApiProperty({ description: 'getPhoneNumber 返回的 code' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

/** 第三步:补全身份信息,完成登录/注册 */
export class WechatCompleteDto {
  @ApiProperty({ description: '微信 openid(第一步返回)' })
  @IsString()
  @IsNotEmpty()
  openid: string;

  @ApiProperty({ description: '手机号(第二步返回,可选)' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: '真实姓名' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '学号(学生)或工号(导师)' })
  @IsString()
  @IsNotEmpty()
  studentNo: string;

  @ApiProperty({ description: '身份:student 学生 / mentor 导师', enum: ['student', 'mentor'], default: 'student' })
  @IsOptional()
  @IsIn(['student', 'mentor'])
  identity?: 'student' | 'mentor';

  @ApiProperty({ description: '专业(学生必填)', enum: MAJORS, required: false })
  @IsOptional()
  @IsIn(MAJORS)
  majorName?: string;

  @ApiProperty({ required: false, description: '微信昵称(可选)' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiProperty({ required: false, description: '微信头像URL(可选)' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
