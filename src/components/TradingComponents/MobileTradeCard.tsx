import React from 'react';
import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import { TradeInfo } from '../../types';
import dayjs from 'dayjs';

interface MobileTradeCardProps {
  trade: TradeInfo;
  isAdmin: boolean;
  onTradeClick: (trade: TradeInfo) => void;
}

const MobileTradeCard: React.FC<MobileTradeCardProps> = React.memo(({ trade, isAdmin, onTradeClick }) => {
  return (
    <Card withBorder radius="md" p="sm" mb="sm">
      <Stack gap={6}>
        <Group justify="space-between">
          <Group gap={6}>
            <Badge variant="light">{trade.tags?.[0] || '未知'}</Badge>
            <Text fw={700}>{trade.txCount || 0}</Text>
          </Group>
          <Text size="xs" c="dimmed">
            {dayjs(trade.created_at).format('MM-DD HH:mm')}
          </Text>
        </Group>

        <Group justify="space-between" grow>
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed">
              毛利
            </Text>
            <Text size="sm" fw={700} c="teal">
              ${trade.gross?.toFixed(4) || '0.0000'}
            </Text>
          </Stack>
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed">
              净利
            </Text>
            <Text size="sm" fw={700} c="blue">
              ${trade.income?.toFixed(4) || '0.0000'}
            </Text>
          </Stack>
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed">
              比例
            </Text>
            <Text size="sm" fw={700} c="red">
              {trade.ratio?.toFixed(2) || '0.00'}%
            </Text>
          </Stack>
        </Group>

        <Group gap={6}>
          <Text size="xs" c="dimmed">
            构建者
          </Text>
          <Badge color="grape" variant="light">
            {trade.builder}
          </Badge>
        </Group>

        <Text
          ff="monospace"
          size="xs"
          c={isAdmin ? 'blue' : 'dimmed'}
          style={{ cursor: isAdmin ? 'pointer' : 'default' }}
          onClick={() => (isAdmin ? onTradeClick(trade) : undefined)}
        >
          {trade.hash.slice(0, 10)}...{trade.hash.slice(-8)}
        </Text>
      </Stack>
    </Card>
  );
});

MobileTradeCard.displayName = 'MobileTradeCard';

export default MobileTradeCard;
