# 组件拆分详细指南

本文档提供前端组件拆分的详细规范和代码示例。

---

## 核心原则

| 原则 | 说明 |
|------|------|
| **可复用** | 通用逻辑提取为 Hook/Utils，避免重复代码 |
| **高内聚** | 相关代码放在同一模块目录下 |
| **低耦合** | 组件间通过 Props/Context 通信，避免直接依赖 |
| **精简文件** | 单文件不超过 500 行，超过则拆分 |

---

## 拆分触发阈值

| 触发条件 | 拆分动作 |
|----------|----------|
| 组件 > 500 行 | 提取 Hook 或拆分为子组件 |
| 类型定义 > 30 行 | 提取到 types.ts |
| 工具函数 > 20 行 | 提取到 utils.ts |
| 常量配置 > 10 项 | 提取到 constants.ts |
| Hook > 500 行 | 拆分为多个专用 Hook |

---

## 文件职责定义

### 1. 组件文件 (.tsx)

**职责**：UI 渲染，接收 Props，调用 Hook

```tsx
// ✅ 正确：组件专注 UI 渲染
import { usePointsPackage } from './use-points-package'
import type { PointsPackageCardProps } from './types'

export function PointsPackageCard({ pkg, onPurchase }: PointsPackageCardProps) {
  const { quantity, setQuantity, isPurchasing, handlePurchase } = usePointsPackage(pkg, onPurchase)

  return (
    <Card className="p-6">
      <CardHeader>
        <CardTitle>{pkg.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <QuantitySelector value={quantity} onChange={setQuantity} />
        <Button onClick={handlePurchase} disabled={isPurchasing}>
          {isPurchasing ? '处理中...' : '购买'}
        </Button>
      </CardContent>
    </Card>
  )
}
```

```tsx
// ❌ 错误：组件内包含大量状态逻辑
export function PointsPackageCard({ pkg, onPurchase }: Props) {
  const [quantity, setQuantity] = useState(1)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePurchase = async () => {
    setIsPurchasing(true)
    setError(null)
    try {
      await onPurchase(pkg.priceId, quantity)
    } catch (err) {
      setError(err instanceof Error ? err.message : '购买失败')
    } finally {
      setIsPurchasing(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(price / 100)
  }

  // ... 更多业务逻辑混杂在组件中
}
```

**行数限制**：≤ 200 行（含 JSX）

---

### 2. Hook 文件 (use-*.ts)

**职责**：状态管理、副作用、业务逻辑

**命名规范**：
- 文件名：`use-feature-name.ts`（kebab-case）
- 函数名：`useFeatureName`（camelCase）

```typescript
// use-points-package.ts
import { useState, useCallback } from 'react'
import type { SubscriptionPlan, UsePointsPackageResult } from './types'

export function usePointsPackage(
  pkg: SubscriptionPlan,
  onPurchase: (priceId: string, quantity: number) => Promise<void>
): UsePointsPackageResult {
  const [quantity, setQuantity] = useState(1)
  const [isPurchasing, setIsPurchasing] = useState(false)

  const handlePurchase = useCallback(async () => {
    if (isPurchasing) return

    setIsPurchasing(true)
    try {
      await onPurchase(pkg.priceId, quantity)
    } finally {
      setIsPurchasing(false)
    }
  }, [pkg.priceId, quantity, onPurchase, isPurchasing])

  const incrementQuantity = useCallback(() => {
    setQuantity((prev) => Math.min(prev + 1, 100))
  }, [])

  const decrementQuantity = useCallback(() => {
    setQuantity((prev) => Math.max(prev - 1, 1))
  }, [])

  return {
    quantity,
    setQuantity,
    isPurchasing,
    handlePurchase,
    incrementQuantity,
    decrementQuantity,
  }
}
```

**行数限制**：≤ 500 行（超过则拆分为多个 Hook）

---

### 3. 类型文件 (types.ts)

**职责**：TypeScript 接口、类型别名、枚举

```typescript
// types.ts

/** 订阅计划 */
export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  priceId: string
  unitAmount: number
  currency: string
  interval: 'month' | 'year'
}

/** 组件 Props */
export interface PointsPackageCardProps {
  pkg: SubscriptionPlan
  onPurchase: (priceId: string, quantity: number) => Promise<void>
  disabled?: boolean
  className?: string
}

/** Hook 返回值 */
export interface UsePointsPackageResult {
  quantity: number
  setQuantity: (qty: number) => void
  isPurchasing: boolean
  handlePurchase: () => Promise<void>
  incrementQuantity: () => void
  decrementQuantity: () => void
}

/** 购买状态枚举 */
export enum PurchaseStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
}

/** 错误类型 */
export interface PurchaseError {
  code: string
  message: string
  details?: Record<string, unknown>
}
```

**何时提取**：类型定义 > 30 行，或被多个文件引用

---

### 4. 工具文件 (utils.ts)

**职责**：纯函数、格式化、计算、验证

```typescript
// utils.ts

/** 格式化价格显示 */
export function formatPrice(amount: number, currency = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

/** 计算折扣百分比 */
export function calculateDiscount(original: number, current: number): number {
  if (original <= 0) return 0
  return Math.round((1 - current / original) * 100)
}

/** 验证数量范围 */
export function isValidQuantity(qty: number, min = 1, max = 100): boolean {
  return Number.isInteger(qty) && qty >= min && qty <= max
}

/** 格式化数量显示 */
export function formatQuantity(qty: number): string {
  if (qty >= 10000) {
    return `${(qty / 10000).toFixed(1)}万`
  }
  if (qty >= 1000) {
    return `${(qty / 1000).toFixed(1)}千`
  }
  return qty.toString()
}

/** 计算总价 */
export function calculateTotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity
}
```

**何时提取**：
- 函数 > 20 行
- 被多个组件复用
- 纯函数（无副作用）

---

### 5. 常量文件 (constants.ts)

**职责**：配置项、枚举值、默认值

```typescript
// constants.ts

/** 数量选项 */
export const QUANTITY_OPTIONS = [1, 5, 10, 20, 50, 100] as const

/** 价格配置 */
export const PRICE_CONFIG = {
  MIN_AMOUNT: 100,
  MAX_AMOUNT: 10000000,
  DEFAULT_CURRENCY: 'CNY',
  DECIMAL_PLACES: 2,
} as const

/** 购买限制 */
export const PURCHASE_LIMITS = {
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 100,
  DAILY_LIMIT: 10,
} as const

/** 错误消息 */
export const ERROR_MESSAGES = {
  PURCHASE_FAILED: '购买失败，请稍后重试',
  INVALID_QUANTITY: '请选择有效的数量',
  NETWORK_ERROR: '网络异常，请检查连接',
  PAYMENT_CANCELED: '支付已取消',
} as const

/** 状态文案 */
export const STATUS_TEXT = {
  idle: '购买',
  loading: '处理中...',
  success: '购买成功',
  error: '购买失败',
} as const
```

**何时提取**：常量配置 > 10 项

---

## 目录组织规范

### 简单组件（< 100 行）

单文件即可，无需拆分：

```
components/ui/
└── Button.tsx
```

### 中等组件（100-200 行）

状态逻辑分离到 Hook：

```
components/points/
├── PointsPackageCard.tsx
└── use-points-package.ts
```

### 复杂组件（> 200 行）

完整模块化结构：

```
components/points/
├── index.ts              # 统一导出
├── PointsPackageCard.tsx # 主组件
├── PointsQuantitySelector.tsx  # 子组件
├── PointsPriceDisplay.tsx      # 子组件
├── use-points-package.ts # 主 Hook
├── use-purchase.ts       # 购买逻辑 Hook
├── types.ts              # 类型定义
├── utils.ts              # 工具函数
└── constants.ts          # 常量配置
```

---

## 导出规范

### index.ts 统一导出

复杂组件必须有 index.ts 作为模块入口：

```typescript
// index.ts

// 导出组件
export { PointsPackageCard } from './PointsPackageCard'
export { PointsQuantitySelector } from './PointsQuantitySelector'

// 导出 Hook
export { usePointsPackage } from './use-points-package'

// 导出类型
export type {
  PointsPackageCardProps,
  SubscriptionPlan,
  UsePointsPackageResult,
} from './types'

// 导出工具函数（按需）
export { formatPrice, calculateDiscount } from './utils'

// 导出常量（按需）
export { QUANTITY_OPTIONS, PRICE_CONFIG } from './constants'
```

### 导入方式

```typescript
// ✅ 正确：从模块入口导入
import { PointsPackageCard, usePointsPackage } from '@/components/points'
import type { PointsPackageCardProps } from '@/components/points'

// ❌ 避免：直接导入内部文件
import { PointsPackageCard } from '@/components/points/PointsPackageCard'
import { usePointsPackage } from '@/components/points/use-points-package'
```

---

## 拆分示例：完整流程

### 拆分前（单文件 280 行）

```tsx
// PointsPackageCard.tsx（280 行，需要拆分）
interface SubscriptionPlan { /* 15 行 */ }
interface Props { /* 10 行 */ }

const QUANTITY_OPTIONS = [1, 5, 10, 20, 50]
const PRICE_CONFIG = { /* 10 行 */ }

function formatPrice(amount: number) { /* 15 行 */ }
function calculateDiscount(a: number, b: number) { /* 10 行 */ }

export function PointsPackageCard({ pkg, onPurchase }: Props) {
  // 状态定义 20 行
  // 业务逻辑 80 行
  // JSX 渲染 120 行
}
```

### 拆分后（6 个文件）

```
components/points/
├── index.ts              # 10 行
├── PointsPackageCard.tsx # 80 行
├── use-points-package.ts # 60 行
├── types.ts              # 35 行
├── utils.ts              # 30 行
└── constants.ts          # 25 行
```

---

## 检查清单

- [ ] 组件文件 ≤ 500 行
- [ ] Hook 文件 ≤ 500 行
- [ ] 类型定义已提取到 types.ts
- [ ] 工具函数已提取到 utils.ts
- [ ] 常量配置已提取到 constants.ts
- [ ] 复杂组件有 index.ts 统一导出
- [ ] 文件命名遵循 kebab-case
- [ ] Hook 命名以 use 开头
- [ ] 组件间通过 Props 通信
