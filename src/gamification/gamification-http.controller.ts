import { Controller, Post, Body } from '@nestjs/common';
import { GamificationService } from './gamification.service';

@Controller('game-http-benchmark')
export class GamificationHttpController {
  constructor(private readonly gamificationService: GamificationService) {}

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
