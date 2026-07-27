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

  @Column('text', { nullable: true })
  asignatura: string;

  @Column('text', { nullable: true })
  descripcion: string;

  @Column('bool', {default: true})
  isActive : boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => CategoryEntity, (cat) => cat.exercise, { cascade: true })
  categories: CategoryEntity[];
}
