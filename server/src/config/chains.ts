export interface ChainConfig {
  id: string;
  name: string;
  displayName: string;
  symbol: string;
  color: string;
  explorerUrl: {
    tx: string;
    address: string;
  };
  enabled: boolean;
  order: number;
}

export const CHAIN_CONFIGS: ChainConfig[] = [
  {
    id: 'BSC',
    name: 'bsc',
    displayName: 'Binance Smart Chain',
    symbol: 'BNB',
    color: '#f59e0b',
    explorerUrl: {
      tx: 'https://bscscan.com/tx/',
      address: 'https://bscscan.com/address/'
    },
    enabled: true,
    order: 1
  },
  {
    id: 'ETH',
    name: 'ethereum',
    displayName: 'Ethereum',
    symbol: 'ETH',
    color: '#3b82f6',
    explorerUrl: {
      tx: 'https://etherscan.io/tx/',
      address: 'https://etherscan.io/address/'
    },
    enabled: true,
    order: 2
  },
  {
    id: 'SOL',
    name: 'solana',
    displayName: 'Solana',
    symbol: 'SOL',
    color: '#8b5cf6',
    explorerUrl: {
      tx: 'https://solscan.io/tx/',
      address: 'https://solscan.io/address/'
    },
    enabled: true,
    order: 3
  },
  {
    id: 'POLYGON',
    name: 'polygon',
    displayName: 'Polygon',
    symbol: 'MATIC',
    color: '#8247e5',
    explorerUrl: {
      tx: 'https://polygonscan.com/tx/',
      address: 'https://polygonscan.com/address/'
    },
    enabled: false,
    order: 4
  },
  {
    id: 'ARBITRUM',
    name: 'arbitrum',
    displayName: 'Arbitrum',
    symbol: 'ARB',
    color: '#28a0f0',
    explorerUrl: {
      tx: 'https://arbiscan.io/tx/',
      address: 'https://arbiscan.io/address/'
    },
    enabled: false,
    order: 5
  },
  {
    id: 'OPTIMISM',
    name: 'optimism',
    displayName: 'Optimism',
    symbol: 'OP',
    color: '#ff0420',
    explorerUrl: {
      tx: 'https://optimistic.etherscan.io/tx/',
      address: 'https://optimistic.etherscan.io/address/'
    },
    enabled: false,
    order: 6
  }
];

export class ChainService {
  private static instance: ChainService;
  private chains: Map<string, ChainConfig> = new Map();
  private repository: any = null;

  private constructor() {
    // 初始化时先加载默认配置，稍后会从数据库加载
    this.loadDefaultChains();
  }

  public static getInstance(): ChainService {
    if (!ChainService.instance) {
      ChainService.instance = new ChainService();
    }
    return ChainService.instance;
  }

  // 设置数据库仓库
  public setRepository(repository: any): void {
    this.repository = repository;
  }

  private loadDefaultChains(): void {
    CHAIN_CONFIGS.forEach(chain => {
      this.chains.set(chain.id, chain);
    });
  }

  // 从数据库加载链配置
  public async loadFromDatabase(): Promise<void> {
    if (!this.repository) {
      console.warn('ChainService: 数据库仓库未设置，使用默认配置');
      return;
    }

    try {
      const dbConfigs = await this.repository.find();
      
      if (dbConfigs.length === 0) {
        // 数据库为空，插入默认配置
        console.log('ChainService: 数据库为空，初始化默认链配置');
        await this.initializeDefaultConfigs();
      } else {
        // 从数据库加载配置
        this.chains.clear();
        dbConfigs.forEach((dbConfig: any) => {
          const chainConfig: ChainConfig = {
            id: dbConfig.id,
            name: dbConfig.name,
            displayName: dbConfig.displayName,
            symbol: dbConfig.symbol,
            color: dbConfig.color,
            explorerUrl: {
              tx: dbConfig.explorerTxUrl,
              address: dbConfig.explorerAddressUrl
            },
            enabled: dbConfig.enabled,
            order: dbConfig.order
          };
          this.chains.set(chainConfig.id, chainConfig);
        });
        console.log(`ChainService: 从数据库加载了 ${dbConfigs.length} 个链配置`);
      }
    } catch (error) {
      console.error('ChainService: 从数据库加载配置失败，使用默认配置', error);
    }
  }

  // 初始化默认配置到数据库
  private async initializeDefaultConfigs(): Promise<void> {
    if (!this.repository) return;

    try {
      for (const config of CHAIN_CONFIGS) {
        const dbConfig = this.repository.create({
          id: config.id,
          name: config.name,
          displayName: config.displayName,
          symbol: config.symbol,
          color: config.color,
          explorerTxUrl: config.explorerUrl.tx,
          explorerAddressUrl: config.explorerUrl.address,
          enabled: config.enabled,
          order: config.order
        });
        await this.repository.save(dbConfig);
      }
      console.log('ChainService: 默认链配置已保存到数据库');
    } catch (error) {
      console.error('ChainService: 保存默认配置到数据库失败', error);
    }
  }

  public getAllChains(): ChainConfig[] {
    return Array.from(this.chains.values())
      .sort((a, b) => a.order - b.order);
  }

  public getEnabledChains(): ChainConfig[] {
    return this.getAllChains().filter(chain => chain.enabled);
  }

  public getChainById(id: string): ChainConfig | undefined {
    id = id.toUpperCase();
    return this.chains.get(id);
  }

  public getChainByName(name: string): ChainConfig | undefined {
    return Array.from(this.chains.values())
      .find(chain => chain.name === name);
  }

  public isChainEnabled(id: string): boolean {
    const chain = this.getChainById(id);
    return chain ? chain.enabled : false;
  }

  public getExplorerUrl(chainId: string, hash: string, type: 'tx' | 'address' = 'tx'): string {
    const chain = this.getChainById(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not found`);
    }
    return chain.explorerUrl[type] + hash;
  }

  public async updateChainConfig(id: string, updates: Partial<ChainConfig>): Promise<boolean> {
    const chain = this.chains.get(id);
    if (!chain) {
      return false;
    }
    
    const updatedChain = { ...chain, ...updates };
    this.chains.set(id, updatedChain);

    // 同步到数据库
    if (this.repository) {
      try {
        await this.repository.update(id, {
          name: updatedChain.name,
          displayName: updatedChain.displayName,
          symbol: updatedChain.symbol,
          color: updatedChain.color,
          explorerTxUrl: updatedChain.explorerUrl.tx,
          explorerAddressUrl: updatedChain.explorerUrl.address,
          enabled: updatedChain.enabled,
          order: updatedChain.order
        });
        console.log(`ChainService: 链配置已更新到数据库: ${id}`);
      } catch (error) {
        console.error(`ChainService: 更新链配置到数据库失败: ${id}`, error);
      }
    }
    
    return true;
  }

  public async addChain(config: ChainConfig): Promise<boolean> {
    if (this.chains.has(config.id)) {
      return false;
    }
    
    this.chains.set(config.id, config);

    // 同步到数据库
    if (this.repository) {
      try {
        const dbConfig = this.repository.create({
          id: config.id,
          name: config.name,
          displayName: config.displayName,
          symbol: config.symbol,
          color: config.color,
          explorerTxUrl: config.explorerUrl.tx,
          explorerAddressUrl: config.explorerUrl.address,
          enabled: config.enabled,
          order: config.order
        });
        await this.repository.save(dbConfig);
        console.log(`ChainService: 新链配置已保存到数据库: ${config.id}`);
      } catch (error) {
        console.error(`ChainService: 保存新链配置到数据库失败: ${config.id}`, error);
        // 如果数据库保存失败，从内存中移除
        this.chains.delete(config.id);
        return false;
      }
    }
    
    return true;
  }

  public async removeChain(id: string): Promise<boolean> {
    const deleted = this.chains.delete(id);
    
    if (deleted && this.repository) {
      try {
        await this.repository.delete(id);
        console.log(`ChainService: 链配置已从数据库删除: ${id}`);
      } catch (error) {
        console.error(`ChainService: 从数据库删除链配置失败: ${id}`, error);
      }
    }
    
    return deleted;
  }

  public getChainIds(): string[] {
    return this.getEnabledChains().map(chain => chain.id);
  }

  public getChainColor(id: string): string {
    const chain = this.getChainById(id);
    return chain ? chain.color : '#6b7280';
  }

  public getChainDisplayName(id: string): string {
    const chain = this.getChainById(id);
    return chain ? chain.displayName : id;
  }
}

export const chainService = ChainService.getInstance();