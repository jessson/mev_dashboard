import React from 'react';
import { Card, SimpleGrid, Stack, Text } from '@mantine/core';
import { ProfitEvent } from '../../types';

interface ProfitStatisticsProps {
  profitData: ProfitEvent;
  isMobile: boolean;
}

const ProfitStatistics: React.FC<ProfitStatisticsProps> = React.memo(({ profitData, isMobile }) => {
  if (!profitData) return null;

  const items = [
    { key: 'today', label: '今日收益', value: profitData.today.income, tx: profitData.today.txCount, color: 'blue' },
    { key: 'yesterday', label: '昨日收益', value: profitData.yesterday.income, tx: profitData.yesterday.txCount, color: 'teal' },
    { key: 'thisWeek', label: '本周收益', value: profitData.thisWeek.income, tx: profitData.thisWeek.txCount, color: 'violet' },
    { key: 'lastWeek', label: '上周收益', value: profitData.lastWeek.income, tx: profitData.lastWeek.txCount, color: 'orange' },
    { key: 'thisMonth', label: '本月收益', value: profitData.thisMonth.income, tx: profitData.thisMonth.txCount, color: 'cyan' },
    { key: 'lastMonth', label: '上月收益', value: profitData.lastMonth.income, tx: profitData.lastMonth.txCount, color: 'pink' },
  ];

  return (
    <SimpleGrid cols={{ base: 2, md: 6 }} spacing="sm" mb={isMobile ? 'md' : 'lg'}>
      {items.map((item) => (
        <Card key={item.key} withBorder radius="md" p="sm">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {item.label}
            </Text>
            <Text fw={700} c={item.color as any}>
              ${item.value.toFixed(2)}
            </Text>
            <Text size="xs" c="dimmed">
              交易: {item.tx}
            </Text>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
});

ProfitStatistics.displayName = 'ProfitStatistics';

export default ProfitStatistics;
