import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentAuditService } from '../common/services/content-audit.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { CreateMessageDto, CreateReplyDto, MessageListDto } from './dto/message-board.dto';

@Injectable()
export class MessageBoardService {
  private readonly logger = new Logger(MessageBoardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ContentAuditService,
    private readonly opLog: OperationLogService,
  ) {}

  /**
   * 发布留言
   * 1. AI 审核内容
   * 2. 审核通过后发布,审核拒绝则保存拒绝原因
   */
  async createMessage(userId: number, dto: CreateMessageDto) {
    // 1. AI 内容审核
    const auditResult = await this.auditService.audit(dto.content);
    const auditStatus = auditResult.passed ? 'APPROVED' : 'REJECTED';

    // 2. 创建留言记录
    const message = await this.prisma.messageBoard.create({
      data: {
        userId,
        content: dto.content.trim(),
        isAnonymous: dto.isAnonymous ?? false,
        auditStatus,
        auditResult: auditResult.reason || null,
        auditBy: 'AI',
      },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    await this.opLog.record(userId, 'message_create', `message:${message.id}`, {
      auditStatus,
      auditReason: auditResult.reason || '',
    });

    if (!auditResult.passed) {
      throw new BadRequestException(
        `内容审核未通过:${auditResult.reason || '包含违规内容'}`,
      );
    }

    return this.formatMessage(message, userId);
  }

  /**
   * 获取留言列表(仅展示审核通过的)
   */
  async getMessageList(userId: number, dto: MessageListDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.messageBoard.findMany({
        where: {
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { replies: { where: { auditStatus: 'APPROVED', status: 'ACTIVE' } } },
          },
        },
      }),
      this.prisma.messageBoard.count({
        where: { auditStatus: 'APPROVED', status: 'ACTIVE' },
      }),
    ]);

    // 查询当前用户是否点赞了这些留言
    const messageIds = items.map((m) => m.id);
    const myLikes = await this.prisma.messageLike.findMany({
      where: { userId, messageId: { in: messageIds } },
      select: { messageId: true },
    });
    const likedSet = new Set(myLikes.map((l) => l.messageId));

    const formattedItems = items.map((m) => ({
      ...this.formatMessage(m, userId),
      replyCount: m._count.replies,
      isLiked: likedSet.has(m.id),
    }));

    return {
      items: formattedItems,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取留言详情及回复
   */
  async getMessageDetail(userId: number, messageId: number) {
    const message = await this.prisma.messageBoard.findFirst({
      where: { id: messageId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!message) {
      throw new NotFoundException('留言不存在');
    }

    if (message.auditStatus !== 'APPROVED') {
      throw new ForbiddenException('该留言尚未通过审核');
    }

    const replies = await this.prisma.messageReply.findMany({
      where: {
        messageId,
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const isLiked = await this.prisma.messageLike.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    return {
      ...this.formatMessage(message, userId),
      replyCount: replies.length,
      isLiked: !!isLiked,
      replies: replies.map((r) => this.formatReply(r, userId)),
    };
  }

  /**
   * 回复留言
   */
  async replyMessage(userId: number, messageId: number, dto: CreateReplyDto) {
    const message = await this.prisma.messageBoard.findUnique({
      where: { id: messageId },
    });

    if (!message || message.status !== 'ACTIVE') {
      throw new NotFoundException('留言不存在');
    }

    if (message.auditStatus !== 'APPROVED') {
      throw new BadRequestException('该留言尚未通过审核,不能回复');
    }

    // AI 审核
    const auditResult = await this.auditService.audit(dto.content);
    const auditStatus = auditResult.passed ? 'APPROVED' : 'REJECTED';

    const reply = await this.prisma.messageReply.create({
      data: {
        messageId,
        userId,
        content: dto.content.trim(),
        isAnonymous: dto.isAnonymous ?? false,
        auditStatus,
        auditResult: auditResult.reason || null,
        auditBy: 'AI',
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // 更新留言回复数
    if (auditResult.passed) {
      await this.prisma.messageBoard.update({
        where: { id: messageId },
        data: { replyCount: { increment: 1 } },
      });
    }

    await this.opLog.record(userId, 'message_reply', `reply:${reply.id}`, {
      messageId,
      auditStatus,
    });

    if (!auditResult.passed) {
      throw new BadRequestException(
        `回复内容审核未通过:${auditResult.reason || '包含违规内容'}`,
      );
    }

    return this.formatReply(reply, userId);
  }

  /**
   * 点赞/取消点赞
   */
  async toggleLike(userId: number, messageId: number) {
    const message = await this.prisma.messageBoard.findUnique({
      where: { id: messageId },
    });

    if (!message || message.status !== 'ACTIVE' || message.auditStatus !== 'APPROVED') {
      throw new NotFoundException('留言不存在');
    }

    const existing = await this.prisma.messageLike.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    if (existing) {
      // 取消点赞
      await this.prisma.messageLike.delete({
        where: { id: existing.id },
      });
      await this.prisma.messageBoard.update({
        where: { id: messageId },
        data: { likeCount: { decrement: 1 } },
      });
      return { liked: false, likeCount: message.likeCount - 1 };
    } else {
      // 点赞
      await this.prisma.messageLike.create({
        data: { messageId, userId },
      });
      await this.prisma.messageBoard.update({
        where: { id: messageId },
        data: { likeCount: { increment: 1 } },
      });
      return { liked: true, likeCount: message.likeCount + 1 };
    }
  }

  /**
   * 删除自己的留言
   */
  async deleteMessage(userId: number, messageId: number) {
    const message = await this.prisma.messageBoard.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('留言不存在');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('只能删除自己的留言');
    }

    await this.prisma.messageBoard.update({
      where: { id: messageId },
      data: { status: 'DELETED' },
    });

    await this.opLog.record(userId, 'message_delete', `message:${messageId}`);

    return { success: true };
  }

  /**
   * 获取我发布的留言
   */
  async getMyMessages(userId: number, dto: MessageListDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.messageBoard.findMany({
        where: { userId, status: { not: 'DELETED' } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.messageBoard.count({
        where: { userId, status: { not: 'DELETED' } },
      }),
    ]);

    return {
      items: items.map((m) => ({
        ...this.formatMessage(m, userId),
        replyCount: m._count.replies,
      })),
      total,
      page,
      pageSize,
    };
  }

  // ============ 工具方法 ============

  private formatMessage(message: any, currentUserId: number) {
    const isAnonymous = message.isAnonymous && message.userId !== currentUserId;
    return {
      id: message.id,
      content: message.content,
      isAnonymous: message.isAnonymous,
      likeCount: message.likeCount,
      replyCount: message.replyCount ?? 0,
      auditStatus: message.auditStatus,
      auditResult: message.auditResult,
      createdAt: message.createdAt,
      user: isAnonymous
        ? { id: 0, name: '匿名用户', avatarUrl: null }
        : {
            id: message.user?.id,
            name: message.user?.name,
            avatarUrl: message.user?.avatarUrl,
          },
      isMine: message.userId === currentUserId,
    };
  }

  private formatReply(reply: any, currentUserId: number) {
    const isAnonymous = reply.isAnonymous && reply.userId !== currentUserId;
    return {
      id: reply.id,
      messageId: reply.messageId,
      content: reply.content,
      isAnonymous: reply.isAnonymous,
      createdAt: reply.createdAt,
      user: isAnonymous
        ? { id: 0, name: '匿名用户', avatarUrl: null }
        : {
            id: reply.user?.id,
            name: reply.user?.name,
            avatarUrl: reply.user?.avatarUrl,
          },
      isMine: reply.userId === currentUserId,
    };
  }
}
