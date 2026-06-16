import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LatencyLogEntity } from './entities/latency-log.entity';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(LatencyLogEntity)
    private readonly latencyRepository: Repository<LatencyLogEntity>,
  ) {}

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

  async getMetricsLog(): Promise<LatencyLogEntity[]> {
    return await this.latencyRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getMetricsBySession(sessionId: number): Promise<LatencyLogEntity[]> {
    return await this.latencyRepository.find({
      where: { sessionId },
      order: { questionId: 'ASC', positionInGame: 'ASC' },
    });
  }
}
