import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { GetCurrentUserId } from '../common/decorators';
import { CommentsService } from './comments.service';
import {
  CreateCommentSchema,
  CreateCommentDto,
  UpdateCommentSchema,
  UpdateCommentDto,
  CursorQuerySchema,
  CursorQueryDto,
} from './dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller()
@UseGuards(JwtAccessGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @SkipThrottle()
  @Get('posts/:postId/comments')
  findByPost(
    @GetCurrentUserId() userId: string,
    @Param('postId') postId: string,
    @Query(new ZodValidationPipe(CursorQuerySchema)) query: CursorQueryDto,
  ) {
    return this.commentsService.findByPost(postId, userId, query);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('posts/:postId/comments')
  createOnPost(
    @GetCurrentUserId() userId: string,
    @Param('postId') postId: string,
    @Body(new ZodValidationPipe(CreateCommentSchema)) dto: CreateCommentDto,
  ) {
    return this.commentsService.createOnPost(postId, userId, dto);
  }

  @SkipThrottle()
  @Get('comments/:commentId/replies')
  findReplies(
    @GetCurrentUserId() userId: string,
    @Param('commentId') commentId: string,
    @Query(new ZodValidationPipe(CursorQuerySchema)) query: CursorQueryDto,
  ) {
    return this.commentsService.findReplies(commentId, userId, query);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('comments/:commentId/replies')
  createReply(
    @GetCurrentUserId() userId: string,
    @Param('commentId') commentId: string,
    @Body(new ZodValidationPipe(CreateCommentSchema)) dto: CreateCommentDto,
  ) {
    return this.commentsService.createReply(commentId, userId, dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Patch('comments/:commentId')
  update(
    @GetCurrentUserId() userId: string,
    @Param('commentId') commentId: string,
    @Body(new ZodValidationPipe(UpdateCommentSchema)) dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(commentId, userId, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.OK)
  remove(
    @GetCurrentUserId() userId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.commentsService.remove(commentId, userId);
  }
}
