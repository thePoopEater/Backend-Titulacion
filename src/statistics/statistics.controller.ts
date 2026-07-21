import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { GamificationService } from '../gamification/gamification.service';

@Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    @Inject(forwardRef(() => GamificationService))
    private readonly gamificationService: GamificationService,
  ) {}

  @Post('trigger-end-round')
  async triggerEndRound() {
    return await this.gamificationService.processRoundResults();
  }

  @Get('report')
  async getMetricsReport() {
    return await this.statisticsService.getMetricsLog();
  }

  @Get('report/session/:sessionId')
  async getMetricsBySession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return await this.statisticsService.getMetricsBySession(sessionId);
  }
}
