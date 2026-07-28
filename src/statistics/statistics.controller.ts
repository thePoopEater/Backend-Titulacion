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

/** Controlador REST de estadísticas y reportes de métricas. */
@Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    @Inject(forwardRef(() => GamificationService))
    private readonly gamificationService: GamificationService,
  ) {}

  /** Fuerza el procesamiento de resultados de la ronda actual. Útil para depuración. */
  @Post('trigger-end-round')
  async triggerEndRound() {
    return await this.gamificationService.processRoundResults();
  }

  /** Obtiene todos los registros de métricas (latencia, puntajes). */
  @Get('report')
  async getMetricsReport() {
    return await this.statisticsService.getMetricsLog();
  }

  /** Obtiene métricas filtradas por sesión de juego. */
  @Get('report/session/:sessionId')
  async getMetricsBySession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return await this.statisticsService.getMetricsBySession(sessionId);
  }
}
