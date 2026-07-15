import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterSchema, RegisterDto, LoginSchema, LoginDto } from './dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GetCurrentUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      dto,
      req.headers['user-agent'],
      req.ip,
    );

    res.cookie(
      'access_token',
      result.accessToken,
      this.authService.getAccessTokenCookieOptions(),
    );
    res.cookie(
      'refresh_token',
      result.refreshToken,
      this.authService.getRefreshTokenCookieOptions(),
    );

    return { user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto,
      req.headers['user-agent'],
      req.ip,
    );

    res.cookie(
      'access_token',
      result.accessToken,
      this.authService.getAccessTokenCookieOptions(),
    );
    res.cookie(
      'refresh_token',
      result.refreshToken,
      this.authService.getRefreshTokenCookieOptions(),
    );

    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token' });
    }

    const result = await this.authService.refresh(
      refreshToken,
      req.headers['user-agent'],
      req.ip,
    );

    res.cookie(
      'access_token',
      result.accessToken,
      this.authService.getAccessTokenCookieOptions(),
    );
    res.cookie(
      'refresh_token',
      result.refreshToken,
      this.authService.getRefreshTokenCookieOptions(),
    );

    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  async logout(
    @GetCurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(userId);

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  async me(@GetCurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    const tokens = await this.authService.generateTokensForUser(
      user.id,
      user.email,
    );

    res.cookie(
      'access_token',
      tokens.accessToken,
      this.authService.getAccessTokenCookieOptions(),
    );
    res.cookie(
      'refresh_token',
      tokens.refreshToken,
      this.authService.getRefreshTokenCookieOptions(),
    );

    const frontendOrigin = this.configService.get<string>('app.frontendOrigin');
    res.redirect(frontendOrigin ?? 'http://localhost:3000');
  }
}
