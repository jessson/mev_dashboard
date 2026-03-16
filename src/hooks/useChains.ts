import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { ChainConfig } from '../types';

const chainKeys = {
  all: ['chains', 'all'] as const,
  enabled: ['chains', 'enabled'] as const,
};

export const useChains = () => {
  const queryClient = useQueryClient();

  const chainsQuery = useQuery({
    queryKey: chainKeys.all,
    queryFn: () => apiService.getChains() as Promise<ChainConfig[]>,
  });

  const enabledChainsQuery = useQuery({
    queryKey: chainKeys.enabled,
    queryFn: () => apiService.getEnabledChains() as Promise<ChainConfig[]>,
  });

  const invalidateChains = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: chainKeys.all }),
      queryClient.invalidateQueries({ queryKey: chainKeys.enabled }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: ({ chainId, config }: { chainId: string; config: Partial<ChainConfig> }) =>
      apiService.updateChainConfig(chainId, config),
    onSuccess: invalidateChains,
  });

  const addMutation = useMutation({
    mutationFn: (config: ChainConfig) => apiService.addChain(config),
    onSuccess: invalidateChains,
  });

  const deleteMutation = useMutation({
    mutationFn: (chainId: string) => apiService.deleteChain(chainId),
    onSuccess: invalidateChains,
  });

  const chains = chainsQuery.data || [];
  const enabledChains = enabledChainsQuery.data || [];

  const getChainById = (id: string) => chains.find((chain) => chain.id === id);

  const getChainColor = (id: string) => getChainById(id)?.color || '#6b7280';

  const getChainDisplayName = (id: string) => getChainById(id)?.displayName || id;

  const getExplorerUrl = (chainId: string, hash: string, type: 'tx' | 'address' = 'tx') => {
    const chain = getChainById(chainId);
    if (!chain) return '#';
    return chain.explorerUrl[type] + hash;
  };

  return {
    chains,
    enabledChains,
    loading: chainsQuery.isLoading || enabledChainsQuery.isLoading,
    error:
      chainsQuery.error instanceof Error
        ? chainsQuery.error.message
        : enabledChainsQuery.error instanceof Error
          ? enabledChainsQuery.error.message
          : null,
    getChainById,
    getChainColor,
    getChainDisplayName,
    getExplorerUrl,
    updateChainConfig: async (chainId: string, config: Partial<ChainConfig>) => {
      try {
        await updateMutation.mutateAsync({ chainId, config });
        return true;
      } catch {
        return false;
      }
    },
    addChain: async (config: ChainConfig) => {
      try {
        await addMutation.mutateAsync(config);
        return true;
      } catch {
        return false;
      }
    },
    deleteChain: async (chainId: string) => {
      try {
        await deleteMutation.mutateAsync(chainId);
        return true;
      } catch {
        return false;
      }
    },
    refetch: invalidateChains,
  };
};
