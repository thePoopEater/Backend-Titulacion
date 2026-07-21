import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { LoginRequestDTO } from './dto/login-request.dto';
import { RegisterRequestDTO } from './dto/register-request.dto';
import { AuthService } from './auth.service';
import { type Response } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserEntity } from './entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async loginUser(
    @Body() loginRequestDTO: LoginRequestDTO,
    @Res() res: Response,
  ) {
    const tokens = await this.authService.login(loginRequestDTO);
    return res.status(HttpStatus.OK).json({
      statusCode: HttpStatus.OK,
      message: 'Usuario logueado correctamente',
      data: tokens,
    });
  }

  @Post('register')
  async registerUser(
    @Body() registerRequestDTO: RegisterRequestDTO,
    @Res() res: Response,
  ) {
    const idUsuarioCreado =
      await this.authService.createUser(registerRequestDTO);
    return res.status(HttpStatus.CREATED).json({
      statusCode: HttpStatus.CREATED,
      message: 'Usuario creado correctamente',
      data: { id: idUsuarioCreado },
    });
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refreshTokens(
    @Body('refreshToken') refreshToken: string,
    @Res() res: Response,
  ) {
    const tokens = await this.authService.refreshTokens(refreshToken);
    return res.status(HttpStatus.OK).json({
      statusCode: HttpStatus.OK,
      message: 'Tokens renovados correctamente',
      data: tokens,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: UserEntity, @Res() res: Response) {
    const profile = await this.authService.getProfile(user.id);
    return res.status(HttpStatus.OK).json({
      statusCode: HttpStatus.OK,
      data: profile,
    });
  }
}
