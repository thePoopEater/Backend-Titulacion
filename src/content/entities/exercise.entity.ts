import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { CategoryEntity } from './category.entity';

@Entity('exercises')
export class ExerciseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  title: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => CategoryEntity, (cat) => cat.exercise, { cascade: true })
  categories: CategoryEntity[];
}
