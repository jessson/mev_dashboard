import React from 'react';
import { Card, Space, List, Typography, Tag, Menu, Button, Badge } from 'antd';
import { Settings, TrendingUp } from 'lucide-react';
import { TokenProfitInfo, TagProfitInfo } from '../../types';

const { Title, Text } = Typography;

interface ChainInfo {
  id: string;
  displayName: string;
  color: string;
}

interface SidebarContentProps {
  // 链相关
  enabledChains: ChainInfo[];
  selectedChain: string;
  onChainSelect: (chainId: string) => void;
  
  // 代币数据
  tokenStats: TokenProfitInfo[];
  tokenScrollRef: any;
  
  // 标签数据
  tagStats: TagProfitInfo[];
  
  // 工具函数
  getExplorerUrl: (chain: string, address: string, type?: 'tx' | 'address') => string;
  
  // 用户和操作
  isAdmin: boolean;
  isMobile?: boolean;
  onChainManagerOpen: () => void;
  onSidebarClose?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = React.memo(({
  enabledChains,
  selectedChain,
  onChainSelect,
  tokenStats,
  tokenScrollRef,
  tagStats,
  getExplorerUrl,
  isAdmin,
  isMobile,
  onChainManagerOpen,
  onSidebarClose
}) => {
  // 链菜单项
  const chainMenuItems = enabledChains.map(chain => ({
    key: chain.id,
    label: (
      <Space>
        <Badge 
          status="processing" 
          color={chain.color}
        />
        <Text>{chain.displayName}</Text>
      </Space>
    )
  }));

  const handleChainSelect = ({ key }: { key: string }) => {
    onChainSelect(key);
    if (isMobile && onSidebarClose) {
      onSidebarClose();
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%', padding: 16 }} size="middle">
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>区块链网络</Title>
        {isAdmin && (
          <Button
            type="text"
            size="small"
            icon={<Settings className="h-4 w-4" />}
            onClick={onChainManagerOpen}
            title="链配置管理"
          />
        )}
      </Space>
      
      <Menu
        mode="vertical"
        selectedKeys={[selectedChain]}
        items={chainMenuItems}
        onSelect={handleChainSelect}
        style={{ border: 0 }}
      />

      {/* 热门代币 */}
      {tokenStats && tokenStats.length > 0 && (
        <Card 
          title="热门代币（前100）" 
          size="small" 
          style={{ marginTop: 16 }}
          bodyStyle={{ padding: 0, maxHeight: 320, overflowY: 'auto' }}
        >
          <List
            ref={tokenScrollRef}
            dataSource={tokenStats}
            renderItem={(token: TokenProfitInfo, index: number) => (
              <List.Item
                key={token.addr}
                style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}
                extra={<Tag color="blue">${token.totalProfit.toFixed(2)}</Tag>}
              >
                <List.Item.Meta
                  title={
                    <Space size="small">
                      <Text strong style={{ fontSize: 12 }}>{token.symbol}</Text>
                      <Tag color="default">#{index + 1}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text style={{ fontSize: 10, color: '#666' }}>
                        {isAdmin ? (
                          <a 
                            href={getExplorerUrl(selectedChain, token.addr, 'address')} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#1890ff' }}
                          >
                            {token.addr.slice(0, 6)}...{token.addr.slice(-4)}
                          </a>
                        ) : (
                          `${token.addr.slice(0, 6)}...${token.addr.slice(-4)}`
                        )}
                      </Text>
                      <Text style={{ fontSize: 9, color: '#999' }}>
                        交易次数: {token.count}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 标签统计 */}
      {tagStats && tagStats.length > 0 && (
        <Card 
          title={
            <Space>
              <TrendingUp className="h-4 w-4" />
              <Text>标签统计</Text>
            </Space>
          }
          size="small"
          bodyStyle={{ padding: 0, maxHeight: 320, overflowY: 'auto' }}
        >
          <List
            dataSource={tagStats}
            renderItem={(tagStat) => (
              <List.Item
                key={`${tagStat.chain}-${tagStat.tag}`}
                style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}
                extra={
                  <Text style={{ fontSize: 9, color: '#999' }}>
                    平均: ${tagStat.txCount > 0 ? (tagStat.totalProfit / tagStat.txCount).toFixed(2) : '0.00'}
                  </Text>
                }
              >
                <List.Item.Meta
                  title={<Text strong style={{ fontSize: 12 }}>{tagStat.tag || '未知标签'}</Text>}
                  description={
                    <Space size="large">
                      <Text style={{ fontSize: 10, color: '#1890ff' }}>
                        ${tagStat.totalProfit.toFixed(2)}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#52c41a' }}>
                        {tagStat.txCount}次
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </Space>
  );
});

SidebarContent.displayName = 'SidebarContent';

export default SidebarContent; 