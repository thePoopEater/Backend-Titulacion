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

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Post('session')
  async createSession(@Body() dto: CreateSessionDto) {
    return await this.gamificationService.createSession(dto);
  }

  @Get('active-sessions')
  async getActiveSessions() {
    return await this.gamificationService.getActiveSessions();
  }

  @Post('active-question')
  async setCurrentQuestion(@Body() dto: SetCurrentQuestionDto) {
    return await this.gamificationService.advanceToQuestionDirect(dto);
  }

  @Post('start-round-flow')
  async startRoundFlow(@Body() dto: ConfigureRoundDto) {
    return await this.gamificationService.configureAndStartRound(dto);
  }

  @Post('next-question')
  async nextQuestion() {
    return await this.gamificationService.advanceToNextQuestionInQueue();
  }

  @Post('close-session/:id')
  async closeSession(@Param('id', ParseIntPipe) id: number) {
    return await this.gamificationService.closeSession(id);
  }
}
