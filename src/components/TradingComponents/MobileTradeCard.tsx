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
    <Card className="mobile-trade-card" p="md" mb="sm">
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap={6}>
            <Badge color="brand">{trade.tags?.[0] || '未知'}</Badge>
            <Text fw={800}>{trade.txCount || 0}</Text>
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
            <Text size="sm" fw={800} c="profit.6">
              ${trade.gross?.toFixed(4) || '0.0000'}
            </Text>
          </Stack>
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed">
              净利
            </Text>
            <Text size="sm" fw={800} c="brand.6">
              ${trade.income?.toFixed(4) || '0.0000'}
            </Text>
          </Stack>
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed">
              比例
            </Text>
            <Text size="sm" fw={800} c="danger.5">
              {trade.ratio?.toFixed(2) || '0.00'}%
            </Text>
          </Stack>
        </Group>

        <Group gap={6}>
          <Text size="xs" c="dimmed">
            构建者
          </Text>
          <Badge color="violet" variant="light">
            {trade.builder}
          </Badge>
        </Group>

        <Text
          className="mono-link"
          size="xs"
          c={isAdmin ? 'brand.6' : 'dimmed'}
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
