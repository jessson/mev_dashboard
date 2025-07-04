import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NodeService } from '../services/node.service';
import { logger } from '../utils/logger';

// 创建节点服务实例
const nodeService = new NodeService();

// 初始化一些模拟数据
nodeService.initMockData();

// 节点状态更新请求类型
interface NodeStatusUpdateRequest {
  online: boolean;
  cpuUsage: number;        // 当前CPU使用率 %
  memoryUsage: number;     // 当前内存使用率 %
  blockHeight: number;     // 当前区块高度
  blockTime: number;       // 当前追块时间 ms
}

export default async function nodeRoutes(fastify: FastifyInstance) {
  
  // 获取所有节点状态 - 需要认证
  fastify.get('/node/status', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
  
      
      // 清理过期节点
      nodeService.cleanupExpiredNodes();
      
      const nodeStatus = nodeService.getAllNodeStatus();
      
  
      
      return {
        success: true,
        data: nodeStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`获取节点状态失败: ${error}`);
      reply.code(500).send({
        success: false,
        error: '获取节点状态失败'
      });
    }
  });

  // 获取特定链的节点状态 - 需要认证  
  fastify.get('/node/status/:chain', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: FastifyRequest<{
    Params: { chain: string }
  }>, reply: FastifyReply) => {
    try {
      const { chain } = request.params;

      
      const nodeStatus = nodeService.getNodeStatus(chain);
      
      if (!nodeStatus) {
        reply.code(404).send({
          success: false,
          error: `节点 ${chain} 未找到`
        });
        return;
      }
      
      return {
        success: true,
        data: nodeStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`获取节点状态失败 ${request.params.chain}:`, error);
      reply.code(500).send({
        success: false,
        error: '获取节点状态失败'
      });
    }
  });

  // 更新节点状态 - 需要认证
  fastify.post('/node/status/:chain', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: FastifyRequest<{
    Params: { chain: string };
    Body: NodeStatusUpdateRequest;
  }>, reply: FastifyReply) => {
    try {
      let { chain } = request.params;
      chain = chain?.toUpperCase();
      const statusData = request.body;
      
      // 验证请求数据
      if (typeof statusData.online !== 'boolean' ||
          typeof statusData.cpuUsage !== 'number' ||
          typeof statusData.memoryUsage !== 'number' || 
          typeof statusData.blockHeight !== 'number' ||
          typeof statusData.blockTime !== 'number') {
        reply.code(400).send({
          success: false,
          error: '请求数据格式错误'
        });
        return;
      }

      // 验证数值范围
      if (statusData.cpuUsage < 0 || statusData.cpuUsage > 100 ||
          statusData.memoryUsage < 0 || statusData.memoryUsage > 100 ||
          statusData.blockTime < 0) {
        reply.code(400).send({
          success: false,
          error: '数值范围错误'
        });
        return;
      }



      // 更新节点状态
      nodeService.updateNodeStatus(chain, statusData);

      // 获取更新后的完整状态（包含计算的平均值和峰值）
      const updatedStatus = nodeService.getAllNodeStatus();

      // 通过WebSocket广播状态更新
      const wsService = (fastify as any).wsService;
      if (wsService) {
        wsService.broadcastNodeStatus(updatedStatus);

      }

      reply.send({
        success: true,
        message: `节点状态已更新: ${chain}`,
        data: nodeService.getNodeStatus(chain),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`更新节点状态失败 ${request.params.chain}:`, error);
      reply.code(500).send({
        success: false,
        error: '更新节点状态失败'
      });
    }
  });

  // 标记节点离线 - 需要认证
  fastify.post('/node/offline/:chain', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: FastifyRequest<{
    Params: { chain: string }
  }>, reply: FastifyReply) => {
    try {
      const { chain } = request.params;


      nodeService.markNodeOffline(chain);

      // 获取更新后的状态
      const updatedStatus = nodeService.getAllNodeStatus();

      // 通过WebSocket广播状态更新
      const wsService = (fastify as any).wsService;
      if (wsService) {
        wsService.broadcastNodeStatus(updatedStatus);
      }

      reply.send({
        success: true,
        message: `节点已标记为离线: ${chain}`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`标记节点离线失败 ${request.params.chain}:`, error);
      reply.code(500).send({
        success: false,
        error: '标记节点离线失败'
      });
    }
  });

  // 获取节点统计摘要 - 需要认证
  fastify.get('/node/summary', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {

      
      // 清理过期节点
      nodeService.cleanupExpiredNodes();
      
      const summary = nodeService.getNodeSummary();
      
      return {
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`获取节点统计摘要失败: ${error}`);
      reply.code(500).send({
        success: false,
        error: '获取节点统计摘要失败'
      });
    }
  });


} 