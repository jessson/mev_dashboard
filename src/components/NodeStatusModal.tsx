import { Modal } from '@mantine/core';
import NodeStatusContent from './dashboard/NodeStatusContent';
import { NodeStatusResponse } from '../types';

interface NodeStatusModalProps {
  visible: boolean;
  onClose: () => void;
  nodeStatus: NodeStatusResponse | null;
  loading?: boolean;
}

const NodeStatusModal = ({ visible, onClose, nodeStatus, loading = false }: NodeStatusModalProps) => {
  return (
    <Modal opened={visible} onClose={onClose} size="90%" title="节点状态监控" centered>
      <NodeStatusContent nodeStatus={nodeStatus} loading={loading} />
    </Modal>
  );
};

export default NodeStatusModal;
