import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { SessionQuestionEntity } from './session-question.entity';

@Entity('game_sessions')
export class GameSessionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(
    () => SessionQuestionEntity,
    (sessionQuestion) => sessionQuestion.session,
  )
  sessionQuestions: SessionQuestionEntity[];
}
