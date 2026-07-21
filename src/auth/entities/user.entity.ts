import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('user')
export class UserEntity { 
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  nombre: string;

  @Column()
  password: string;

  @Column()
  email: string;
}
