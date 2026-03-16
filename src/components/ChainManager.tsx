import { Modal } from '@mantine/core';
import ChainManagementContent from './dashboard/ChainManagementContent';

interface ChainManagerProps {
  visible: boolean;
  onClose: () => void;
}

const ChainManager = ({ visible, onClose }: ChainManagerProps) => {
  return (
    <Modal opened={visible} onClose={onClose} size="xl" title="链配置管理" centered>
      <ChainManagementContent />
    </Modal>
  );
};

export default ChainManager;
