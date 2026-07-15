import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenPayload } from './dto/token-payload.interface';
import { AuthProvider } from '@prisma/client';
import { normalizeEmail } from '../common/utils/normalize-email';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string, ipAddress?: string) {
    const normalizedEmail = normalizeEmail(dto.email);

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const saltRounds =
      this.configService.get<number>('app.bcryptSaltRounds') ?? 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        accounts: {
          create: {
            provider: AuthProvider.LOCAL,
            providerAccountId: normalizedEmail,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.createRefreshSession(
      user.id,
      tokens.refreshTokenHash,
      tokens.refreshJti,
      userAgent,
      ipAddress,
    );

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(dto: LoginDto, userAgent?: string, ipAddress?: string) {
    const normalizedEmail = normalizeEmail(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.createRefreshSession(
      user.id,
      tokens.refreshTokenHash,
      tokens.refreshJti,
      userAgent,
      ipAddress,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(refreshToken: string, userAgent?: string, ipAddress?: string) {
    const payload = this.verifyRefreshToken(refreshToken);
    if (!payload || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenJti: payload.jti },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const valid = await bcrypt.compare(refreshToken, session.tokenHash);
    if (!valid) {
      await this.revokeAllSessions(payload.sub);
      throw new ForbiddenException(
        'Token reuse detected, all sessions revoked',
      );
    }

    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), rotatedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.createRefreshSession(
      user.id,
      tokens.refreshTokenHash,
      tokens.refreshJti,
      userAgent,
      ipAddress,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    return user;
  }

  async validateOAuthUser(profile: {
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    providerAccountId: string;
  }) {
    const normalizedEmail = normalizeEmail(profile.email);

    const existingAccount = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      return {
        id: existingAccount.user.id,
        email: existingAccount.user.email,
        firstName: existingAccount.user.firstName,
        lastName: existingAccount.user.lastName,
        avatarUrl: existingAccount.user.avatarUrl,
      };
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      await this.prisma.authAccount.create({
        data: {
          userId: existingUser.id,
          provider: AuthProvider.GOOGLE,
          providerAccountId: profile.providerAccountId,
        },
      });
      return {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        avatarUrl: existingUser.avatarUrl,
      };
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        accounts: {
          create: {
            provider: AuthProvider.GOOGLE,
            providerAccountId: profile.providerAccountId,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    return user;
  }

  async generateTokensForUser(userId: string, email: string) {
    return this.generateTokens(userId, email);
  }

  private async generateTokens(userId: string, email: string) {
    const refreshJti = this.generateJti();

    const accessPayload: TokenPayload = { sub: userId, email };
    const refreshPayload: TokenPayload = {
      sub: userId,
      email,
      jti: refreshJti,
    };

    const accessTtl =
      this.configService.get<number>('app.accessTokenTtlSeconds') ?? 900;
    const refreshTtlDays =
      this.configService.get<number>('app.refreshTokenTtlDays') ?? 30;
    const accessSecret =
      this.configService.get<string>('app.jwtAccessSecret') ?? '';
    const refreshSecret =
      this.configService.get<string>('app.jwtRefreshSecret') ?? '';

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: accessSecret,
      expiresIn: accessTtl,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: `${refreshTtlDays}d`,
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    return { accessToken, refreshToken, refreshTokenHash, refreshJti };
  }

  private async createRefreshSession(
    userId: string,
    tokenHash: string,
    tokenJti: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const ttlDays =
      this.configService.get<number>('app.refreshTokenTtlDays') ?? 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    return this.prisma.refreshSession.create({
      data: {
        userId,
        tokenJti,
        tokenHash,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });
  }

  private generateJti(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `jti_${timestamp}${random}`;
  }

  private verifyRefreshToken(token: string): TokenPayload | null {
    try {
      const refreshSecret =
        this.configService.get<string>('app.jwtRefreshSecret') ?? '';
      return this.jwtService.verify<TokenPayload>(token, {
        secret: refreshSecret,
      });
    } catch {
      return null;
    }
  }

  private async revokeAllSessions(userId: string) {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  getAccessTokenCookieOptions() {
    const nodeEnv = this.configService.get<string>('app.nodeEnv');
    const isProd = nodeEnv === 'production';
    const accessTtl =
      this.configService.get<number>('app.accessTokenTtlSeconds') ?? 900;
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('none' as const) : ('lax' as const),
      path: '/',
      maxAge: accessTtl * 1000,
    };
  }

  getRefreshTokenCookieOptions() {
    const nodeEnv = this.configService.get<string>('app.nodeEnv');
    const isProd = nodeEnv === 'production';
    const ttlDays =
      this.configService.get<number>('app.refreshTokenTtlDays') ?? 30;
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('none' as const) : ('lax' as const),
      path: '/',
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    };
  }
}
