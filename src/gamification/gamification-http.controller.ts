import { Controller, Post, Body } from '@nestjs/common';
import { GamificationService } from './gamification.service';

/** Controlador HTTP alternativo para benchmarking de respuestas. */
@Controller('game-http-benchmark')
export class GamificationHttpController {
  constructor(private readonly gamificationService: GamificationService) {}

  /** Envía una respuesta vía HTTP en lugar de WebSocket (para pruebas de rendimiento). */
  @Post('submit')
  async handleSubmitHttp(
    @Body()
    body: {
      socketId: string;
      placements: Record<number, number>;
      clientTimestamp: number;
    },
  ) {
    return await this.gamificationService.registerPlayerResponse(
      body.socketId,
      body.placements,
      body.clientTimestamp,
      'HTTP',
    );
  }
}
