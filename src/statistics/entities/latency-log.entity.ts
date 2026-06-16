import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('latency_logs')
@Index(['sessionId', 'questionId'])
export class LatencyLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sessionId: number;

  @Column()
  questionId: number;

  @Column({ length: 100 })
  playerId: string;

  @Column('text')
  selectedAlternative: string;

  @Column()
  scoreObtained: number;

  @Column()
  isCorrect: boolean;

  @Column()
  positionInGame: number;

  @Column({ type: 'bigint' })
  clientTimestamp: string;

  @Column({ type: 'bigint' })
  arrivalTimestamp: string;

  @Index()
  @Column()
  compensatedLagMs: number;

  @Column({ type: 'float', nullable: true })
  totalTimeSeconds: number;

  @CreateDateColumn()
  createdAt: Date;
}
