import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('trade_info')
@Index(['chain', 'createdAt'])
@Index(['builder'])
@Index(['hash'], { unique: true })
export class TradeInfo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('varchar')
  chain!: string;

  @Column('varchar')
  builder!: string;

  @Column('varchar', { unique: true })
  hash!: string;

  @Column('simple-json', { nullable: true })
  vicHashes!: string[];

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  gross!: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  bribe!: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  income!: number;

  @Column('int', { default: 0 })
  txCount!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  ratio!: number;

  @Column('text', { nullable: true })
  extraInfo!: string;

  @Column('simple-json', { nullable: true })
  tags!: string[];

  @Column('simple-json', { nullable: true })
  incTokens!: { addr: string; symbol: string }[];

  @CreateDateColumn()
  createdAt!: Date;
}