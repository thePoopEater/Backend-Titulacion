import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterRequestDTO } from './dto/register-request.dto';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { InsertResult } from 'typeorm/browser';
import { LoginRequestDTO } from './dto/login-request.dto';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async createUser(registerRequestDTO: RegisterRequestDTO): Promise<number> {
    const password = registerRequestDTO.password;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result: InsertResult = await this.userRepository.insert({
      nombre: registerRequestDTO.nombre,
      email: registerRequestDTO.email,
      password: hashedPassword,
    });

    const idUser = result.identifiers[0].id;
    return idUser;
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserEntity | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(
    loginRequestDTO: LoginRequestDTO,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.validateUser(
      loginRequestDTO.email,
      loginRequestDTO.password,
    );
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      nombre: user.nombre,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user);

    return { accessToken, refreshToken };
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, revoked: false },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.userRepository.findOne({
      where: { id: storedToken.userId },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    await this.revokeRefreshToken(storedToken.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      nombre: user.nombre,
    };

    const newAccessToken = this.jwtService.sign(payload);
    const newRefreshToken = await this.generateRefreshToken(user);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async getProfile(userId: number): Promise<Omit<UserEntity, 'password'>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  private async generateRefreshToken(user: UserEntity): Promise<string> {
    const token = randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.insert({
      token,
      userId: user.id,
      expiresAt,
    });

    return token;
  }

  private async revokeRefreshToken(id: number): Promise<void> {
    await this.refreshTokenRepository.update(id, { revoked: true });
  }
}
