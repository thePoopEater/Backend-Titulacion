import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LatencyLogEntity } from './entities/latency-log.entity';

/**
 * Servicio de estadísticas y métricas.
 * Gestiona la persistencia y consulta de latencia,
 * puntajes y resultados de partidas.
 */
@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(LatencyLogEntity)
    private readonly latencyRepository: Repository<LatencyLogEntity>,
  ) {}

  /**
   * Guarda los resultados de una ronda completa en BD.
   * Calcula el delay de red como arrivalTimestamp - clientTimestamp.
   */
  async saveRoundStats(results: any[]): Promise<void> {
    const records = results.map((player) => {
      const networkDelayMs = player.arrivalTimestamp - player.clientTimestamp;

      return this.latencyRepository.create({
        sessionId: player.sessionId,
        questionId: player.questionId,
        playerId: player.playerId,
        selectedAlternative: player.selectedAlternative,
        scoreObtained: player.scoreObtained,
        isCorrect: player.isCorrect,
        positionInGame: player.positionInGame,
        clientTimestamp: player.clientTimestamp.toString(),
        arrivalTimestamp: player.arrivalTimestamp.toString(),
        compensatedLagMs: networkDelayMs,
        totalTimeSeconds: player.totalTimeSeconds,
      });
    });

    await this.latencyRepository.save(records);
  }

  /** Obtiene todos los registros de métricas, ordenados por fecha descendente. */
  async getMetricsLog(): Promise<LatencyLogEntity[]> {
    return await this.latencyRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /** Obtiene las métricas filtradas por sesión. */
  async getMetricsBySession(sessionId: number): Promise<LatencyLogEntity[]> {
    return await this.latencyRepository.find({
      where: { sessionId },
      order: { questionId: 'ASC', positionInGame: 'ASC' },
    });
  }
}
