import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

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

export const useChains = () => {
  const [chains, setChains] = useState<ChainConfig[]>([]);
  const [enabledChains, setEnabledChains] = useState<ChainConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChains = async () => {
    try {
      setLoading(true);
      const [allChains, enabled] = await Promise.all([
        apiService.getChains(),
        apiService.getEnabledChains()
      ]);
      setChains(allChains);
      setEnabledChains(enabled);
      setError(null);
    } catch (err) {
      setError('获取链配置失败');
      console.error('Failed to fetch chains:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChains();
  }, []);

  const getChainById = (id: string): ChainConfig | undefined => {
    return chains.find(chain => chain.id === id);
  };

  const getChainColor = (id: string): string => {
    const chain = getChainById(id);
    return chain ? chain.color : '#6b7280';
  };

  const getChainDisplayName = (id: string): string => {
    const chain = getChainById(id);
    return chain ? chain.displayName : id;
  };

  const getExplorerUrl = (chainId: string, hash: string, type: 'tx' | 'address' = 'tx'): string => {
    const chain = getChainById(chainId);
    if (!chain) {
      return '#';
    }
    return chain.explorerUrl[type] + hash;
  };

  const updateChainConfig = async (chainId: string, config: Partial<ChainConfig>) => {
    try {
      await apiService.updateChainConfig(chainId, config);
      await fetchChains(); // 重新获取数据
      return true;
    } catch (err) {
      console.error('Failed to update chain config:', err);
      return false;
    }
  };

  const addChain = async (config: ChainConfig) => {
    try {
      await apiService.addChain(config);
      await fetchChains(); // 重新获取数据
      return true;
    } catch (err) {
      console.error('Failed to add chain:', err);
      return false;
    }
  };

  const deleteChain = async (chainId: string) => {
    try {
      await apiService.deleteChain(chainId);
      await fetchChains(); // 重新获取数据
      return true;
    } catch (err) {
      console.error('Failed to delete chain:', err);
      return false;
    }
  };

  return {
    chains,
    enabledChains,
    loading,
    error,
    getChainById,
    getChainColor,
    getChainDisplayName,
    getExplorerUrl,
    updateChainConfig,
    addChain,
    deleteChain,
    refetch: fetchChains
  };
};