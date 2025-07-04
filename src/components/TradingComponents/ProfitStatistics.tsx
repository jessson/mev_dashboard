import React from 'react';
import { Row, Col, Card, Statistic, Typography, Space } from 'antd';
import { ProfitEvent } from '../../types';

const { Text } = Typography;

interface ProfitStatisticsProps {
  profitData: ProfitEvent;
  isMobile: boolean;
}

const ProfitStatistics: React.FC<ProfitStatisticsProps> = React.memo(({ 
  profitData, 
  isMobile 
}) => {
  // 计算今日收益比例 (income/gross * 100)
  const getTodayProfitRatio = () => {
    if (!profitData?.today) return 0;
    const { today } = profitData;
    if (today.gross === 0) return 0;
    return (today.income / today.gross * 100);
  };

  if (!profitData) return null;

  return (
    <Row gutter={[8, 8]} style={{ marginBottom: isMobile ? 16 : 24 }}>
      <Col xs={12} sm={8} md={4}>
        <Card size="small">
          <Statistic
            title="今日收益"
            value={profitData.today.income}
            precision={2}
            prefix="$"
            valueStyle={{ color: '#1890ff', fontSize: isMobile ? 14 : 16 }}
          />
          <Space style={{ width: '100%', justifyContent: 'space-between', marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 10 }}>
              交易: {profitData.today.txCount}
            </Text>
            <Text 
              style={{ 
                fontSize: 10,
                color: getTodayProfitRatio() >= 0 ? '#52c41a' : '#f5222d'
              }}
            >
              {getTodayProfitRatio() >= 0 ? '+' : ''}{getTodayProfitRatio().toFixed(2)}%
            </Text>
          </Space>
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small">
          <Statistic
            title="昨日收益"
            value={profitData.yesterday.income}
            precision={2}
            prefix="$"
            valueStyle={{ color: '#52c41a', fontSize: isMobile ? 14 : 16 }}
          />
          <Text type="secondary" style={{ fontSize: 10 }}>
            交易: {profitData.yesterday.txCount}
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small">
          <Statistic
            title="本周收益"
            value={profitData.thisWeek.income}
            precision={2}
            prefix="$"
            valueStyle={{ color: '#722ed1', fontSize: isMobile ? 14 : 16 }}
          />
          <Text type="secondary" style={{ fontSize: 10 }}>
            交易: {profitData.thisWeek.txCount}
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small">
          <Statistic
            title="上周收益"
            value={profitData.lastWeek.income}
            precision={2}
            prefix="$"
            valueStyle={{ color: '#fa8c16', fontSize: isMobile ? 14 : 16 }}
          />
          <Text type="secondary" style={{ fontSize: 10 }}>
            交易: {profitData.lastWeek.txCount}
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small">
          <Statistic
            title="本月收益"
            value={profitData.thisMonth.income}
            precision={2}
            prefix="$"
            valueStyle={{ color: '#13c2c2', fontSize: isMobile ? 14 : 16 }}
          />
          <Text type="secondary" style={{ fontSize: 10 }}>
            交易: {profitData.thisMonth.txCount}
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small">
          <Statistic
            title="上月收益"
            value={profitData.lastMonth.income}
            precision={2}
            prefix="$"
            valueStyle={{ color: '#eb2f96', fontSize: isMobile ? 14 : 16 }}
          />
          <Text type="secondary" style={{ fontSize: 10 }}>
            交易: {profitData.lastMonth.txCount}
          </Text>
        </Card>
      </Col>
    </Row>
  );
});

ProfitStatistics.displayName = 'ProfitStatistics';

export default ProfitStatistics; 