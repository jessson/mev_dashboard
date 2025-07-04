import React, { useState } from 'react';
import { 
  Modal, 
  Table, 
  Button, 
  Switch, 
  Tag, 
  Space, 
  Form, 
  Input, 
  ColorPicker, 
  InputNumber,
  message,
  Popconfirm,
  Card
} from 'antd';
import { Plus, Edit, Trash2, Settings } from 'lucide-react';
import { useChains, ChainConfig } from '../hooks/useChains';
import type { ColumnsType } from 'antd/es/table';

interface ChainManagerProps {
  visible: boolean;
  onClose: () => void;
}

const ChainManager: React.FC<ChainManagerProps> = ({ visible, onClose }) => {
  const { 
    chains, 
    updateChainConfig, 
    addChain, 
    deleteChain, 
    refetch 
  } = useChains();
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingChain, setEditingChain] = useState<ChainConfig | null>(null);
  const [form] = Form.useForm();

  const handleToggleEnabled = async (chainId: string, enabled: boolean) => {
    const success = await updateChainConfig(chainId, { enabled });
    if (success) {
      message.success(`链 ${chainId} 已${enabled ? '启用' : '禁用'}`);
    } else {
      message.error('操作失败');
    }
  };

  const handleEdit = (chain: ChainConfig) => {
    setEditingChain(chain);
    form.setFieldsValue({
      ...chain,
      color: chain.color,
      txExplorerUrl: chain.explorerUrl.tx,
      addressExplorerUrl: chain.explorerUrl.address
    });
    setEditModalVisible(true);
  };

  const handleAdd = () => {
    form.resetFields();
    setEditingChain(null);
    setAddModalVisible(true);
  };

  const handleSave = async (values: any) => {
    const chainData: ChainConfig = {
      id: values.id,
      name: values.name,
      displayName: values.displayName,
      symbol: values.symbol,
      color: typeof values.color === 'string' ? values.color : values.color.toHexString(),
      explorerUrl: {
        tx: values.txExplorerUrl,
        address: values.addressExplorerUrl
      },
      enabled: values.enabled ?? true,
      order: values.order ?? 999
    };

    let success = false;
    if (editingChain) {
      success = await updateChainConfig(editingChain.id, chainData);
    } else {
      success = await addChain(chainData);
    }

    if (success) {
      message.success(editingChain ? '链配置已更新' : '链已添加');
      setEditModalVisible(false);
      setAddModalVisible(false);
      form.resetFields();
    } else {
      message.error(editingChain ? '更新失败' : '添加失败');
    }
  };

  const handleDelete = async (chainId: string) => {
    const success = await deleteChain(chainId);
    if (success) {
      message.success('链已删除');
    } else {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<ChainConfig> = [
    {
      title: '链ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: string, record) => (
        <Tag color={record.color}>{id}</Tag>
      )
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 150
    },
    {
      title: '符号',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 80
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 80,
      render: (color: string) => (
        <div 
          className="w-6 h-6 rounded border"
          style={{ backgroundColor: color }}
        />
      )
    },
    {
      title: '排序',
      dataIndex: 'order',
      key: 'order',
      width: 80,
      sorter: (a, b) => a.order - b.order
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggleEnabled(record.id, checked)}
          size="small"
        />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<Edit className="h-4 w-4" />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确定删除这个链吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<Trash2 className="h-4 w-4" />}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const formItems = (
    <>
      <Form.Item
        name="id"
        label="链ID"
        rules={[{ required: true, message: '请输入链ID' }]}
      >
        <Input placeholder="如: BSC, ETH, SOL" disabled={!!editingChain} />
      </Form.Item>
      
      <Form.Item
        name="name"
        label="链名称"
        rules={[{ required: true, message: '请输入链名称' }]}
      >
        <Input placeholder="如: bsc, ethereum, solana" />
      </Form.Item>
      
      <Form.Item
        name="displayName"
        label="显示名称"
        rules={[{ required: true, message: '请输入显示名称' }]}
      >
        <Input placeholder="如: Binance Smart Chain" />
      </Form.Item>
      
      <Form.Item
        name="symbol"
        label="代币符号"
        rules={[{ required: true, message: '请输入代币符号' }]}
      >
        <Input placeholder="如: BNB, ETH, SOL" />
      </Form.Item>
      
      <Form.Item
        name="color"
        label="主题色"
        rules={[{ required: true, message: '请选择主题色' }]}
      >
        <ColorPicker showText />
      </Form.Item>
      
      <Form.Item
        name="txExplorerUrl"
        label="交易浏览器URL"
        rules={[{ required: true, message: '请输入交易浏览器URL' }]}
      >
        <Input placeholder="如: https://bscscan.com/tx/" />
      </Form.Item>
      
      <Form.Item
        name="addressExplorerUrl"
        label="地址浏览器URL"
        rules={[{ required: true, message: '请输入地址浏览器URL' }]}
      >
        <Input placeholder="如: https://bscscan.com/address/" />
      </Form.Item>
      
      <Form.Item
        name="order"
        label="排序"
        rules={[{ required: true, message: '请输入排序' }]}
      >
        <InputNumber min={1} placeholder="排序数字，越小越靠前" style={{ width: '100%' }} />
      </Form.Item>
      
      <Form.Item
        name="enabled"
        label="启用状态"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>
    </>
  );

  return (
    <>
      <Modal
        title={
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>链配置管理</span>
          </div>
        }
        open={visible}
        onCancel={onClose}
        width={800}
        footer={[
          <Button key="close" onClick={onClose}>
            关闭
          </Button>
        ]}
      >
        <div className="mb-4">
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={handleAdd}
          >
            添加新链
          </Button>
        </div>
        
        <Table
          columns={columns}
          dataSource={chains}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ y: 400 }}
        />
      </Modal>

      {/* 编辑模态框 */}
      <Modal
        title="编辑链配置"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          {formItems}
        </Form>
      </Modal>

      {/* 添加模态框 */}
      <Modal
        title="添加新链"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={() => form.submit()}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{ enabled: true, order: 999 }}
        >
          {formItems}
        </Form>
      </Modal>
    </>
  );
};

export default ChainManager;