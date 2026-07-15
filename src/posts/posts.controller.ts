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
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { GetCurrentUserId } from '../common/decorators';
import { PostsService } from './posts.service';
import {
  CreatePostSchema,
  CreatePostDto,
  UpdatePostSchema,
  UpdatePostDto,
  FeedQuerySchema,
  FeedQueryDto,
} from './dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('posts')
@UseGuards(JwtAccessGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @SkipThrottle()
  @Get('feed')
  feed(
    @GetCurrentUserId() userId: string,
    @Query(new ZodValidationPipe(FeedQuerySchema)) query: FeedQueryDto,
  ) {
    return this.postsService.feed(userId, query);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  create(
    @GetCurrentUserId() userId: string,
    @Body(new ZodValidationPipe(CreatePostSchema)) dto: CreatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.postsService.create(userId, dto, file);
  }

  @SkipThrottle()
  @Get(':postId')
  findOne(@GetCurrentUserId() userId: string, @Param('postId') postId: string) {
    return this.postsService.findOne(postId, userId);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Patch(':postId')
  update(
    @GetCurrentUserId() userId: string,
    @Param('postId') postId: string,
    @Body(new ZodValidationPipe(UpdatePostSchema)) dto: UpdatePostDto,
  ) {
    return this.postsService.update(postId, userId, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  remove(@GetCurrentUserId() userId: string, @Param('postId') postId: string) {
    return this.postsService.remove(postId, userId);
  }
}
