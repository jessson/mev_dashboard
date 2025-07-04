import React from 'react';
import { Modal, Table, Tag, Progress, Statistic, Card, Row, Col, Tooltip } from 'antd';
import { 
  Server, 
  Cpu, 
  MemoryStick, 
  Clock,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { NodeStatus, NodeStatusResponse } from '../types';
import { useChains } from '../hooks/useChains';

interface NodeStatusModalProps {
  visible: boolean;
  onClose: () => void;
  nodeStatus: NodeStatusResponse | null;
  loading?: boolean;
}

const NodeStatusModal: React.FC<NodeStatusModalProps> = ({
  visible,
  onClose,
  nodeStatus,
  loading = false
}) => {
  const { getChainDisplayName, getChainColor } = useChains();

  // 格式化数值显示
  const formatValue = (value: number, unit: string, precision: number = 2): string => {
    return `${value.toFixed(precision)}${unit}`;
  };

  // 获取状态颜色
  const getStatusColor = (value: number, thresholds: { warning: number; danger: number }) => {
    if (value >= thresholds.danger) return '#ff4d4f';
    if (value >= thresholds.warning) return '#faad14';
    return '#52c41a';
  };

  // 渲染指标卡片
  const renderMetricCard = (
    title: string,
    icon: React.ReactNode,
    metric: { current: number; average: number; peak: number },
    unit: string,
    thresholds: { warning: number; danger: number }
  ) => {
    const color = getStatusColor(metric.current, thresholds);
    
    return (
      <Card size="small" className="h-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div style={{ color }}>{icon}</div>
            <span className="font-medium text-sm">{title}</span>
          </div>
          <Progress
            type="circle"
            percent={metric.current}
            size={40}
            strokeColor={color}
            format={() => `${metric.current.toFixed(1)}`}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-gray-500">当前</div>
            <div className="font-bold" style={{ color }}>
              {formatValue(metric.current, unit, unit === 'ms' ? 0 : 1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">平均</div>
            <div className="font-medium text-blue-600">
              {formatValue(metric.average, unit, unit === 'ms' ? 0 : 1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">峰值</div>
            <div className="font-medium text-orange-600">
              {formatValue(metric.peak, unit, unit === 'ms' ? 0 : 1)}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const columns = [
    {
      title: '链',
      dataIndex: 'chain',
      key: 'chain',
      width: 100,
      render: (chain: string) => (
        <div className="flex items-center space-x-2">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getChainColor(chain) }}
          />
          <span className="font-medium">{getChainDisplayName(chain)}</span>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'online',
      key: 'online',
      width: 80,
      render: (online: boolean) => (
        <div className="flex items-center space-x-1">
          {online ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <Tag color={online ? 'green' : 'red'}>
            {online ? '在线' : '离线'}
          </Tag>
        </div>
      ),
    },
    {
      title: 'CPU使用率',
      dataIndex: 'cpuUsage',
      key: 'cpuUsage',
      width: 200,
      render: (cpuUsage: any) => renderMetricCard(
        'CPU',
        <Cpu className="h-4 w-4" />,
        cpuUsage,
        '%',
        { warning: 70, danger: 90 }
      ),
    },
    {
      title: '内存使用率',
      dataIndex: 'memoryUsage',
      key: 'memoryUsage',
      width: 200,
      render: (memoryUsage: any) => renderMetricCard(
        'Memory',
        <MemoryStick className="h-4 w-4" />,
        memoryUsage,
        '%',
        { warning: 80, danger: 95 }
      ),
    },
    {
      title: '追块时间',
      dataIndex: 'blockTime',
      key: 'blockTime',
      width: 200,
      render: (blockTime: any) => renderMetricCard(
        'Block Time',
        <Clock className="h-4 w-4" />,
        blockTime,
        'ms',
        { warning: 3000, danger: 5000 }
      ),
    },
    {
      title: '区块高度',
      dataIndex: 'blockHeight',
      key: 'blockHeight',
      width: 120,
      render: (height: number) => (
        <Statistic
          value={height}
          precision={0}
          valueStyle={{ fontSize: '14px' }}
        />
      ),
    },
    {
      title: '最后更新',
      dataIndex: 'lastUpdate',
      key: 'lastUpdate',
      width: 140,
      render: (time: string) => (
        <Tooltip title={new Date(time).toLocaleString()}>
          <div className="text-xs text-gray-500">
            {new Date(time).toLocaleTimeString()}
          </div>
        </Tooltip>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2">
          <Server className="h-5 w-5 text-blue-600" />
          <span>节点状态监控</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={null}
      bodyStyle={{ padding: '16px' }}
    >
      {/* 概览统计 */}
      {nodeStatus?.summary && (
        <Row gutter={16} className="mb-4">
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="总节点数"
                value={nodeStatus.summary.total}
                prefix={<Server className="h-4 w-4" />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="在线节点"
                value={nodeStatus.summary.online}
                prefix={<Wifi className="h-4 w-4 text-green-500" />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="离线节点"
                value={nodeStatus.summary.offline}
                prefix={<WifiOff className="h-4 w-4 text-red-500" />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 节点详情表格 */}
      <Table
        columns={columns}
        dataSource={nodeStatus?.nodes || []}
        rowKey="chain"
        loading={loading}
        pagination={false}
        scroll={{ x: 1100 }}
        size="small"
      />
    </Modal>
  );
};

export default NodeStatusModal; 