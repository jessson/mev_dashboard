// Mock数据
export const mockWelcomeStats = [
  {
    chain: 'BSC',
    income: 2827.773,
    txCount: 1256
  },
  {
    chain: 'ETH',
    income: 1543.892,
    txCount: 892
  },
  {
    chain: 'SOL',
    income: 891.445,
    txCount: 634
  }
];

export const mockTrades = [
  {
    id: 1,
    chain: 'BSC',
    builder: 'Razor: T5ANKVtdUG',
    hash: '0x644df398bb210ff881dad1b503ece2c0524a1a06f71d3e07dc7c30796d5d875',
    vicHashes: ['0x123abc456def789ghi012jkl345mno678pqr901stu234vwx567yz890abc123def', '0x456def789ghi012jkl345mno678pqr901stu234vwx567yz890abc123def456ghi'],
    gross: 0.0976,
    bribe: 0.0109,
    income: 0.0797,
    txCount: 10061,
    ratio: 81.68,
    extraInfo: '7372981-5.892231589497678e-05->USDT->0xe65ea0-30=2.892231589497678e-05->WBNB->0x9d920b-30=0.0003371255340226806->USDT->0xf47fe4-41=1.394852769712518e-05->WBNB->0x6323c-20=5.918176494106737e-05',
    tags: ['Arb', 'Backrun'],
    incTokens: [
      { addr: '0x55d398326f99059ff775485246999027b3197955', symbol: 'USDT' },
      { addr: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', symbol: 'WBNB' }
    ],
    created_at: '2025-01-21T21:14:19Z'
  },
  {
    id: 2,
    chain: 'BSC',
    builder: 'Razor: T5ANKVtdUG',
    hash: '0xca9e44d2da58cb1f08da49347c1cb45dcc3a0ac26d50ff2fc17ab8c957553',
    vicHashes: ['0x789ghi012jkl345mno678pqr901stu234vwx567yz890abc123def456ghi789jkl'],
    gross: 0.1415,
    bribe: 0.1136,
    income: 0.0106,
    txCount: 0,
    ratio: 7.50,
    extraInfo: '7564440-0.0003371255340226806->WBNB->0x9d920b-30=2.892231589497678e-05->USDT->0xe65ea0-30=1.394852769712518e-05',
    tags: ['Arb', 'Block'],
    incTokens: [
      { addr: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', symbol: 'WBNB' },
      { addr: '0x55d398326f99059ff775485246999027b3197955', symbol: 'USDT' }
    ],
    created_at: '2025-01-21T21:14:12Z'
  },
  {
    id: 3,
    chain: 'ETH',
    builder: 'Flashbots',
    hash: '0x007f7ec6873c638b0ee0caad2de3f74e85012cdadc39bf5ac8dda3f66aa96d6',
    vicHashes: ['0xabc123def456ghi789jkl012mno345pqr678stu901vwx234yz567abc890def123'],
    gross: 0.0446,
    bribe: 0.0313,
    income: 0.0036,
    txCount: 0,
    ratio: 8.00,
    extraInfo: '4824288-0.0001394852769712518->USDT->0xf47fe4-41=1.394852769712518e-05->WETH->0xa0b86a-20=2.892231589497678e-05',
    tags: ['Arb', 'Block', 'Univ4'],
    incTokens: [
      { addr: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT' },
      { addr: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH' },
      { addr: '0xa0b86a3e40c6b40b8f2e7b6b48b7d9a1b6a36e39', symbol: 'UNI' }
    ],
    created_at: '2025-01-21T21:14:09Z'
  },
  {
    id: 4,
    chain: 'SOL',
    builder: 'Jito',
    hash: '0x40603469b37dd9478f44fe83cfacc333f37636b43bb24e873e73ff158a818d7',
    vicHashes: [],
    gross: 0.0153,
    bribe: 0.0013,
    income: 0.0002,
    txCount: 0,
    ratio: 1.53,
    extraInfo: '1334726-5.918176494106737e-05->WSOL->So11111111111111111111111111111111111111112-20=1.394852769712518e-05',
    tags: ['Arb', 'Backrun'],
    incTokens: [
      { addr: 'So11111111111111111111111111111111111111112', symbol: 'WSOL' },
      { addr: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' }
    ],
    created_at: '2025-01-21T21:14:00Z'
  },
  {
    id: 5,
    chain: 'BSC',
    builder: 'Builder5',
    hash: '0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    vicHashes: [],
    gross: 0.2345,
    bribe: 0.0234,
    income: 0.1876,
    txCount: 5432,
    ratio: 79.98,
    extraInfo: '8901234-0.0005678901234567890->BUSD->0x12345-25=3.456789012345678e-05->WBNB->0x67890-35=0.0007890123456789012',
    tags: ['48Feed', 'Arb'],
    incTokens: [
      { addr: '0xe9e7cea3dedca5984780bafc599bd69add087d56', symbol: 'BUSD' },
      { addr: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', symbol: 'WBNB' },
      { addr: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', symbol: 'USDC' }
    ],
    created_at: '2025-01-21T20:45:30Z'
  },
  {
    id: 6,
    chain: 'ETH',
    builder: 'Builder6',
    hash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    vicHashes: ['0x111222333444555666777888999aaabbbcccdddeeefffggghhhjjjkkklllmmm'],
    gross: 0.3456,
    bribe: 0.0456,
    income: 0.2789,
    txCount: 1234,
    ratio: 80.67,
    extraInfo: '5678901-0.0008901234567890123->USDC->0xabcde-30=4.567890123456789e-05->WETH->0xfghij-40=0.0009012345678901234',
    tags: ['Univ4', 'Block'],
    incTokens: [
      { addr: '0xa0b73e1ff0b80914ab6fe0444e65848c4c34450b', symbol: 'USDC' },
      { addr: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH' },
      { addr: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI' }
    ],
    created_at: '2025-01-21T19:30:15Z'
  }
];

export const mockProfits = [
  {
    chain: 'BSC',
    today: { income: 191.435, gross: 210.123, txCount: 45 },
    yesterday: { income: 169.425, gross: 185.891, txCount: 42 },
    thisWeek: { income: 2827.773, gross: 3100.234, txCount: 567 },
    lastWeek: { income: 2156.891, gross: 2400.123, txCount: 445 },
    thisMonth: { income: 8934.567, gross: 9800.123, txCount: 1890 },
    lastMonth: { income: 7234.891, gross: 8100.234, txCount: 1567 }
  },
  {
    chain: 'ETH',
    today: { income: 89.234, gross: 95.678, txCount: 23 },
    yesterday: { income: 84.567, gross: 90.789, txCount: 21 },
    thisWeek: { income: 1543.892, gross: 1698.281, txCount: 289 },
    lastWeek: { income: 1234.567, gross: 1357.824, txCount: 234 },
    thisMonth: { income: 5678.901, gross: 6246.791, txCount: 1123 },
    lastMonth: { income: 4567.890, gross: 5024.679, txCount: 987 }
  },
  {
    chain: 'SOL',
    today: { income: 45.678, gross: 50.246, txCount: 12 },
    yesterday: { income: 43.456, gross: 47.802, txCount: 11 },
    thisWeek: { income: 891.445, gross: 980.590, txCount: 156 },
    lastWeek: { income: 678.901, gross: 746.791, txCount: 123 },
    thisMonth: { income: 3456.789, gross: 3802.468, txCount: 678 },
    lastMonth: { income: 2345.678, gross: 2580.246, txCount: 567 }
  }
];

export const mockWarnings = [
  {
    id: 1,
    create_at: '2025-01-21T10:30:00Z',
    type: '高风险交易',
    msg: '检测到异常大额交易，交易金额超过正常范围，建议立即检查相关账户安全性。该交易涉及金额为$50,000，远超过平均交易金额$500的100倍，可能存在洗钱或其他非法活动的风险。',
    chain: 'BSC'
  },
  {
    id: 2,
    create_at: '2025-01-21T09:15:00Z',
    type: '网络拥堵',
    msg: 'ETH网络当前交易费用异常高涨，Gas费用已达到200 Gwei，建议暂缓非紧急交易。预计拥堵将持续2-4小时，建议等待网络恢复正常后再进行大额交易。',
    chain: 'ETH'
  },
  {
    id: 3,
    create_at: '2025-01-21T08:45:00Z',
    type: '套利机会',
    msg: 'SOL网络发现高收益套利机会，预计收益率15%，建议快速执行。该机会涉及RAY/SOL交易对，价差异常，预计套利窗口仅持续10-15分钟。',
    chain: 'SOL'
  }
];

export const mockTops = [
  {
    chain: 'BSC',
    pools: [
      { symbol: 'OL/USDT', address: '0x1234567890abcdef1234567890abcdef12345678', counter: 196 },
      { symbol: 'BULLA/USDT', address: '0x2345678901bcdef12345678901bcdef123456789', counter: 146 },
      { symbol: 'USDT/BULLA', address: '0x3456789012cdef123456789012cdef1234567890', counter: 145 },
      { symbol: 'USDT/USD1', address: '0x4567890123def1234567890123def12345678901', counter: 132 },
      { symbol: 'USD1/WBNB', address: '0x567890123def1234567890123def123456789012', counter: 68 }
    ],
    builders: [
      { name: 'Razor', address: '0xabcdef1234567890abcdef1234567890abcdef12', counter: 89 },
      { name: 'Flashbots', address: '0xbcdef12345678901bcdef12345678901bcdef123', counter: 67 },
      { name: 'Builder3', address: '0xcdef123456789012cdef123456789012cdef1234', counter: 45 },
      { name: 'Builder4', address: '0xdef1234567890123def1234567890123def12345', counter: 34 },
      { name: 'Builder5', address: '0xef12345678901234ef12345678901234ef123456', counter: 23 }
    ]
  },
  {
    chain: 'ETH',
    pools: [
      { symbol: 'USDC/ETH', address: '0x6789012345ef123456789012345ef123456789012', counter: 234 },
      { symbol: 'WETH/USDT', address: '0x789012345ef123456789012345ef1234567890123', counter: 189 },
      { symbol: 'DAI/USDC', address: '0x89012345ef123456789012345ef12345678901234', counter: 156 },
      { symbol: 'UNI/ETH', address: '0x9012345ef123456789012345ef123456789012345', counter: 123 },
      { symbol: 'LINK/ETH', address: '0x012345ef123456789012345ef1234567890123456', counter: 98 }
    ],
    builders: [
      { name: 'Flashbots', address: '0x1111aaaa2222bbbb3333cccc4444dddd5555eeee', counter: 156 },
      { name: 'Eden', address: '0x2222bbbb3333cccc4444dddd5555eeee6666ffff', counter: 134 },
      { name: 'BloXroute', address: '0x3333cccc4444dddd5555eeee6666ffff7777gggg', counter: 98 },
      { name: 'Manifold', address: '0x4444dddd5555eeee6666ffff7777gggg8888hhhh', counter: 76 },
      { name: 'Builder6', address: '0x5555eeee6666ffff7777gggg8888hhhh9999iiii', counter: 54 }
    ]
  },
  {
    chain: 'SOL',
    pools: [
      { symbol: 'SOL/USDC', address: 'So11111111111111111111111111111111111111112', counter: 167 },
      { symbol: 'RAY/SOL', address: 'So22222222222222222222222222222222222222223', counter: 134 },
      { symbol: 'SRM/USDC', address: 'So33333333333333333333333333333333333333334', counter: 98 },
      { symbol: 'ORCA/SOL', address: 'So44444444444444444444444444444444444444445', counter: 76 },
      { symbol: 'MNGO/USDC', address: 'So55555555555555555555555555555555555555556', counter: 54 }
    ],
    builders: [
      { name: 'Jito', address: 'Jito1111111111111111111111111111111111111111', counter: 89 },
      { name: 'Triton', address: 'Trit2222222222222222222222222222222222222222', counter: 67 },
      { name: 'Solana Labs', address: 'SolL3333333333333333333333333333333333333333', counter: 45 },
      { name: 'Builder7', address: 'Buil4444444444444444444444444444444444444444', counter: 34 },
      { name: 'Builder8', address: 'Buil5555555555555555555555555555555555555555', counter: 23 }
    ]
  }
];

export const mockUser = {
  username: 'demo_user',
  type: 'admin' as const  // 改为admin以便测试所有功能
};

export const mockTagProfits = [
  { chain: 'BSC', tag: '48Feed', total_profit: 2.97 },
  { chain: 'BSC', tag: 'Arb', total_profit: 191.43 },
  { chain: 'BSC', tag: 'Backrun', total_profit: 53.74 },
  { chain: 'BSC', tag: 'Univ4', total_profit: 93.74 },
  { chain: 'BSC', tag: 'Block', total_profit: 134.72 },
  { chain: 'ETH', tag: 'Arb', total_profit: 89.23 },
  { chain: 'ETH', tag: 'Backrun', total_profit: 34.56 },
  { chain: 'ETH', tag: 'Univ4', total_profit: 67.89 },
  { chain: 'ETH', tag: 'Block', total_profit: 45.23 },
  { chain: 'SOL', tag: 'Arb', total_profit: 45.67 },
  { chain: 'SOL', tag: 'Backrun', total_profit: 23.45 }
];

export const mockChains = [
  {
    id: 'BSC',
    name: 'bsc',
    displayName: 'Binance Smart Chain',
    symbol: 'BNB',
    color: '#f59e0b',
    explorerUrl: {
      tx: 'https://bscscan.com/tx/',
      address: 'https://bscscan.com/address/'
    },
    enabled: true,
    order: 1
  },
  {
    id: 'ETH',
    name: 'ethereum',
    displayName: 'Ethereum',
    symbol: 'ETH',
    color: '#3b82f6',
    explorerUrl: {
      tx: 'https://etherscan.io/tx/',
      address: 'https://etherscan.io/address/'
    },
    enabled: true,
    order: 2
  },
  {
    id: 'SOL',
    name: 'solana',
    displayName: 'Solana',
    symbol: 'SOL',
    color: '#8b5cf6',
    explorerUrl: {
      tx: 'https://solscan.io/tx/',
      address: 'https://solscan.io/address/'
    },
    enabled: true,
    order: 3
  },
  {
    id: 'POLYGON',
    name: 'polygon',
    displayName: 'Polygon',
    symbol: 'MATIC',
    color: '#8247e5',
    explorerUrl: {
      tx: 'https://polygonscan.com/tx/',
      address: 'https://polygonscan.com/address/'
    },
    enabled: false,
    order: 4
  },
  {
    id: 'ARBITRUM',
    name: 'arbitrum',
    displayName: 'Arbitrum',
    symbol: 'ARB',
    color: '#28a0f0',
    explorerUrl: {
      tx: 'https://arbiscan.io/tx/',
      address: 'https://arbiscan.io/address/'
    },
    enabled: false,
    order: 5
  },
  {
    id: 'OPTIMISM',
    name: 'optimism',
    displayName: 'Optimism',
    symbol: 'OP',
    color: '#ff0420',
    explorerUrl: {
      tx: 'https://optimistic.etherscan.io/tx/',
      address: 'https://optimistic.etherscan.io/address/'
    },
    enabled: false,
    order: 6
  }
];