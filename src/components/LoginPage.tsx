import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Space, Alert } from 'antd';
import { User, Lock, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import { apiService } from '../services/api';

const { Title, Paragraph } = Typography;

interface LoginPageProps {
  onLogin: (user: any) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [form] = Form.useForm();

  // 检查API连接状态
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isConnected = await apiService.testConnection();
        setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      } catch (error) {
        setConnectionStatus('disconnected');
      }
    };

    checkConnection();
  }, []);

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      console.log('🔐 开始登录流程:', values.username);
      const response = await apiService.login(values.username, values.password);
      message.success('登录成功');
      onLogin(response.user);
    } catch (error: any) {
      console.error('❌ 登录失败:', error);
      message.error(`登录失败: ${error.message || '请检查用户名和密码'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('checking');
    try {
      const isConnected = await apiService.testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      message.info(isConnected ? 'API连接正常' : 'API连接失败');
    } catch (error) {
      setConnectionStatus('disconnected');
      message.error('API连接测试失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-4">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <Title level={2} className="!mb-2">MEV Dashboard</Title>
          <Paragraph className="text-gray-600">
            登录以访问您的MEV交易数据
          </Paragraph>
        </div>

        {/* 连接状态指示器 */}
        <div className="mb-4">
          <Alert
            message={
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {connectionStatus === 'checking' ? (
                    <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  ) : connectionStatus === 'connected' ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  )}
                  <span>
                    {connectionStatus === 'checking' && '检查连接中...'}
                    {connectionStatus === 'connected' && 'API连接正常'}
                    {connectionStatus === 'disconnected' && 'API连接失败'}
                  </span>
                </div>
                <Button 
                  type="link" 
                  size="small" 
                  onClick={handleTestConnection}
                  loading={connectionStatus === 'checking'}
                >
                  重新测试
                </Button>
              </div>
            }
            type={connectionStatus === 'connected' ? 'success' : connectionStatus === 'disconnected' ? 'error' : 'info'}
            showIcon={false}
          />
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            size="large"
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<User className="w-4 h-4 text-gray-400" />}
                placeholder="请输入用户名"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<Lock className="w-4 h-4 text-gray-400" />}
                placeholder="请输入密码"
              />
            </Form.Item>

            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                disabled={connectionStatus === 'disconnected'}
                className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 border-0 hover:from-blue-700 hover:to-purple-700"
              >
                {connectionStatus === 'disconnected' ? 'API连接失败，无法登录' : '登录'}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;