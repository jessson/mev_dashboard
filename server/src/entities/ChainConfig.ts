import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('chain_configs')
export class ChainConfig {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  name!: string;

  @Column('varchar')
  displayName!: string;

  @Column('varchar')
  symbol!: string;

  @Column('varchar')
  color!: string;

  @Column('text')
  explorerTxUrl!: string;

  @Column('text')
  explorerAddressUrl!: string;

  @Column('boolean', { default: true })
  enabled!: boolean;

  @Column('int', { default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
} 