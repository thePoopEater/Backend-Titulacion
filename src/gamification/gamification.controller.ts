import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { GamificationService } from './gamification.service';
import {
  CreateSessionDto,
  SetCurrentQuestionDto,
  ConfigureRoundDto,
} from './dto/game.dto';

/** Controlador REST del módulo de gamificación (sesiones, rondas, preguntas). */
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  /** Crea una nueva sesión de juego. */
  @Post('session')
  async createSession(@Body() dto: CreateSessionDto) {
    return await this.gamificationService.createSession(dto);
  }

  /** Obtiene todas las sesiones activas. */
  @Get('active-sessions')
  async getActiveSessions() {
    return await this.gamificationService.getActiveSessions();
  }

  /** Obtiene todas las sesiones (activas e inactivas). */
  @Get('sessions')
  async getAllSessions() {
    return await this.gamificationService.getAllSessions();
  }

  /** Obtiene una sesión por ID con sus ejercicios. */
  @Get('session/:id')
  async getSession(@Param('id', ParseIntPipe) id: number) {
    return await this.gamificationService.getSessionById(id);
  }

  /** Establece un ejercicio como activo en la sesión. */
  @Post('active-question')
  async setCurrentQuestion(@Body() dto: SetCurrentQuestionDto) {
    return await this.gamificationService.advanceToQuestionDirect(dto);
  }

  /** Configura y arranca una ronda completa con cola de ejercicios y tiempos. */
  @Post('start-round-flow')
  async startRoundFlow(@Body() dto: ConfigureRoundDto) {
    return await this.gamificationService.configureAndStartRound(dto);
  }

  /** Avanza al siguiente ejercicio en la cola de la ronda. */
  @Post('next-question')
  async nextQuestion() {
    return await this.gamificationService.advanceToNextQuestionInQueue();
  }

  /** Cierra una sesión de juego. */
  @Post('close-session/:id')
  async closeSession(@Param('id', ParseIntPipe) id: number) {
    return await this.gamificationService.closeSession(id);
  }
}
