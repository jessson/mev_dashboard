import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { chainService, ChainConfig } from '../config/chains';

export async function chainRoutes(fastify: FastifyInstance) {
  // 获取所有链配置
  fastify.get('/chains', async () => {
    try {
      return chainService.getAllChains();
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取链配置失败');
    }
  });

  // 获取启用的链配置
  fastify.get('/chains/enabled', async () => {
    try {
      return chainService.getEnabledChains();
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取启用链配置失败');
    }
  });

  // 获取单个链配置
  fastify.get('/chains/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    try {
      const chain = chainService.getChainById(request.params.id);
      if (!chain) {
        throw new Error('链不存在');
      }
      return chain;
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取链配置失败');
    }
  });

  // 更新链配置（需要管理员权限）
  fastify.put('/chains/:id', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          order: { type: 'number' },
          color: { type: 'string' },
          displayName: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string }, 
    Body: Partial<ChainConfig> 
  }>, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      const success = await chainService.updateChainConfig(request.params.id, request.body);
      if (!success) {
        return reply.code(404).send({ error: '链不存在' });
      }

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('更新链配置失败');
    }
  });

  // 添加新链（需要管理员权限）
  fastify.post('/chains', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['id', 'name', 'displayName', 'symbol', 'color', 'explorerUrl'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          displayName: { type: 'string' },
          symbol: { type: 'string' },
          color: { type: 'string' },
          explorerUrl: {
            type: 'object',
            properties: {
              tx: { type: 'string' },
              address: { type: 'string' }
            }
          },
          enabled: { type: 'boolean' },
          order: { type: 'number' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: ChainConfig }>, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      const success = await chainService.addChain(request.body);
      if (!success) {
        return reply.code(400).send({ error: '链已存在' });
      }

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('添加链失败');
    }
  });

  // 删除链（需要管理员权限）
  fastify.delete('/chains/:id', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      const success = await chainService.removeChain(request.params.id);
      if (!success) {
        return reply.code(404).send({ error: '链不存在' });
      }

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('删除链失败');
    }
  });
}