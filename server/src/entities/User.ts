import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserType {
  NORMAL = 'normal',
  ADMIN = 'admin',
  GUEST = 'guest'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('varchar', { unique: true })
  username!: string;

  @Column('varchar')
  password!: string;

  @Column('varchar', { default: UserType.NORMAL })
  type!: UserType;

  @Column('boolean', { default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}