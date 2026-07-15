import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { GetCurrentUserId } from '../common/decorators';
import { LikesService } from './likes.service';
import { CursorQuerySchema, CursorQueryDto } from './dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller()
@UseGuards(JwtAccessGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('posts/:postId/like')
  @HttpCode(HttpStatus.OK)
  likePost(
    @GetCurrentUserId() userId: string,
    @Param('postId') postId: string,
  ) {
    return this.likesService.likePost(postId, userId);
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Delete('posts/:postId/like')
  @HttpCode(HttpStatus.OK)
  unlikePost(
    @GetCurrentUserId() userId: string,
    @Param('postId') postId: string,
  ) {
    return this.likesService.unlikePost(postId, userId);
  }

  @SkipThrottle()
  @Get('posts/:postId/likes')
  getPostLikes(
    @GetCurrentUserId() userId: string,
    @Param('postId') postId: string,
    @Query(new ZodValidationPipe(CursorQuerySchema)) query: CursorQueryDto,
  ) {
    return this.likesService.getPostLikes(postId, userId, query);
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('comments/:commentId/like')
  @HttpCode(HttpStatus.OK)
  likeComment(
    @GetCurrentUserId() userId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.likesService.likeComment(commentId, userId);
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Delete('comments/:commentId/like')
  @HttpCode(HttpStatus.OK)
  unlikeComment(
    @GetCurrentUserId() userId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.likesService.unlikeComment(commentId, userId);
  }

  @SkipThrottle()
  @Get('comments/:commentId/likes')
  getCommentLikes(
    @GetCurrentUserId() userId: string,
    @Param('commentId') commentId: string,
    @Query(new ZodValidationPipe(CursorQuerySchema)) query: CursorQueryDto,
  ) {
    return this.likesService.getCommentLikes(commentId, userId, query);
  }
}
