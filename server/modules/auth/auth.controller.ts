import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type AuthUser } from './auth.service';
import { verifyToken } from './auth.util';

interface RegisterDto {
  username: string;
  password: string;
  shopName?: string;
}
interface LoginDto {
  username: string;
  password: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.username, body.password, body.shopName);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.username, body.password);
  }

  @Get('me')
  me(@Req() req: Request): AuthUser | null {
    const auth = (req.headers.authorization as string) || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return null;
    return this.authService.meFromToken(token);
  }
}
