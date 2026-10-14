import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MessageBoardService } from './message-board.service';
import { CreateMessageDto, CreateReplyDto, MessageListDto, UpdateMessageDto } from './dto/message-board.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('留言板')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('message-board')
export class MessageBoardController {
  constructor(private readonly messageBoard: MessageBoardService) {}

  @Post('messages')
  @ApiOperation({ summary: '发布留言（自动AI审核）' })
  createMessage(@CurrentUser() user: AuthUser, @Body() dto: CreateMessageDto) {
    return this.messageBoard.createMessage(user.id, user.role, dto);
  }

  @Get('messages')
  @ApiOperation({ summary: '获取留言列表（仅审核通过的）' })
  getMessages(@CurrentUser() user: AuthUser, @Query() dto: MessageListDto) {
    return this.messageBoard.getMessageList(user.id, dto);
  }

  @Get('messages/me')
  @ApiOperation({ summary: '我发布的留言' })
  getMyMessages(@CurrentUser() user: AuthUser, @Query() dto: MessageListDto) {
    return this.messageBoard.getMyMessages(user.id, dto);
  }

  @Get('messages/:id')
  @ApiOperation({ summary: '留言详情（含回复）' })
  getMessageDetail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.messageBoard.getMessageDetail(user.id, id);
  }

  @Post('messages/:id/reply')
  @ApiOperation({ summary: '回复留言（自动AI审核）' })
  replyMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReplyDto,
  ) {
    return this.messageBoard.replyMessage(user.id, user.role, id, dto);
  }

  @Post('messages/:id/like')
  @ApiOperation({ summary: '点赞/取消点赞' })
  toggleLike(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.messageBoard.toggleLike(user.id, id);
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: '编辑留言（本人或管理员，修改后重新AI审核）' })
  updateMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messageBoard.updateMessage(user.id, user.role, id, dto);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: '删除留言（本人或管理员）' })
  deleteMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.messageBoard.deleteMessage(user.id, user.role, id);
  }

  @Get('admin/messages')
  @Roles(UserRole.ACADEMIC_ADMIN, UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '管理员获取全部留言（含审核未通过）' })
  getAdminMessages(@Query() dto: MessageListDto) {
    return this.messageBoard.getAdminMessages(dto);
  }
}
