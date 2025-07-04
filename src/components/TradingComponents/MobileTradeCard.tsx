import React from 'react';
import { Card, Space, Row, Col, Typography, Tag } from 'antd';
import { TradeInfo } from '../../types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface MobileTradeCardProps {
  trade: TradeInfo;
  isAdmin: boolean;
  onTradeClick: (trade: TradeInfo) => void;
}

const MobileTradeCard: React.FC<MobileTradeCardProps> = React.memo(({ 
  trade, 
  isAdmin, 
  onTradeClick 
}) => {
  const handleClick = () => {
    if (isAdmin) {
      onTradeClick(trade);
    }
  };

  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Tag color="blue">{trade.tags?.[0] || '未知'}</Tag>
            <Text strong style={{ fontSize: 14 }}>{trade.txCount || 0}</Text>
          </Space>
          <Text style={{ fontSize: 12, color: '#666' }}>
            {dayjs(trade.created_at).format('MM-DD HH:mm')}
          </Text>
        </Space>
        
        <Row gutter={8}>
          <Col span={8} style={{ textAlign: 'center' }}>
            <Space direction="vertical" size="small">
              <Text type="secondary" style={{ fontSize: 11 }}>总收益</Text>
              <Text style={{ color: '#52c41a', fontSize: 12, fontWeight: 'bold' }}>
                ${trade.gross?.toFixed(4) || '0.0000'}
              </Text>
            </Space>
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <Space direction="vertical" size="small">
              <Text type="secondary" style={{ fontSize: 11 }}>实际收入</Text>
              <Text style={{ color: '#1890ff', fontSize: 12, fontWeight: 'bold' }}>
                ${trade.income?.toFixed(4) || '0.0000'}
              </Text>
            </Space>
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <Space direction="vertical" size="small">
              <Text type="secondary" style={{ fontSize: 11 }}>比例</Text>
              <Text style={{ color: '#f5222d', fontSize: 12, fontWeight: 'bold' }}>
                {trade.ratio?.toFixed(2) || '0.00'}%
              </Text>
            </Space>
          </Col>
        </Row>
        
        <Space>
          <Text style={{ fontSize: 11, color: '#666' }}>构建者: </Text>
          <Tag color="purple">{trade.builder}</Tag>
        </Space>
        
        <Space>
          <Text style={{ fontSize: 11, color: '#666' }}>哈希: </Text>
          <Text 
            code 
            style={{ 
              fontSize: 10, 
              color: '#999',
              cursor: isAdmin ? 'pointer' : 'default' 
            }}
            onClick={handleClick}
          >
            {isAdmin ? (
              <Text style={{ color: '#999', fontSize: 10 }}>
                {trade.hash.slice(0, 8)}...{trade.hash.slice(-6)}
              </Text>
            ) : (
              `${trade.hash.slice(0, 8)}...${trade.hash.slice(-6)}`
            )}
          </Text>
        </Space>
        
        {trade.tags && trade.tags.length > 1 && (
          <Space wrap>
            {trade.tags.slice(1).map(tag => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        )}
      </Space>
    </Card>
  );
});

MobileTradeCard.displayName = 'MobileTradeCard';

export default MobileTradeCard; 