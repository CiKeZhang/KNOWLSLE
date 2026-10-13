import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AiRecommendInputDto, MentorFeedbackDto, ChatSendDto } from './dto/ai.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';

@ApiTags('AI 择校推荐')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('recommend')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'AI 择校择专业推荐(规则加权+大模型可解释)' })
  recommend(@CurrentUser() user: AuthUser, @Body() dto: AiRecommendInputDto) {
    return this.ai.recommend(user.id, dto);
  }

  @Get('me/recommendations')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: '学生:我的历史推荐记录' })
  myRecommendations(@CurrentUser() user: AuthUser) {
    return this.ai.myRecommendations(user.id);
  }

  @Post('recommendations/:id/feedback')
  @Roles(UserRole.MAJOR_MENTOR, UserRole.COUNSELOR, UserRole.ACADEMIC_ADMIN)
  @ApiOperation({ summary: '导师:对推荐结果人工校准(持续优化推荐模型)' })
  feedback(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: MentorFeedbackDto,
  ) {
    return this.ai.mentorFeedback(id, user.id, dto.itemId, dto.comment);
  }

  // ============ AI 择校 Agent 对话 ============

  @Get('chat/sessions')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'AI 对话:获取我的会话列表' })
  getChatSessions(@CurrentUser() user: AuthUser) {
    return this.ai.getChatSessions(user.id);
  }

  @Get('chat/sessions/:id/messages')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'AI 对话:获取会话历史消息' })
  getChatMessages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ai.getChatMessages(user.id, id);
  }

  @Post('chat/send')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'AI 对话:发送消息(Agent 模式,支持工具调用)' })
  chatSend(@CurrentUser() user: AuthUser, @Body() dto: ChatSendDto) {
    const sessionId = dto.sessionId ? parseInt(dto.sessionId, 10) : undefined;
    return this.ai.chatSend(user.id, sessionId, dto.message);
  }

  @Post('chat/sessions')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'AI 对话:创建新会话' })
  createChatSession(@CurrentUser() user: AuthUser) {
    return this.ai.createChatSession(user.id);
  }

  @Delete('chat/sessions/:id')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'AI 对话:删除会话' })
  deleteChatSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ai.deleteChatSession(user.id, id);
  }
}
