import { supabase } from '../../lib/supabase';
import type { LedgerEntry, Provider, ShopCatalog, ShopOrder } from './shopModel';

// 积分包的下单和查单走已上线的支付函数 ai-group-payment（和入群权益共用商户配置）
async function invokeShop<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-group-payment', { body });
  if (error) {
    let message = '支付服务暂时不可用，请稍后再试。';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error.trim()) message = payload.error;
      } catch {
        // 非 JSON 的错误响应沿用默认提示
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const shopApi = {
  catalog: () => invokeShop<ShopCatalog>({ action: 'shop-products' }),
  createOrder: (productCode: string, provider: Provider) => invokeShop<ShopOrder>({ action: 'shop-create-order', product_code: productCode, provider }),
  syncOrder: (orderNo: string) => invokeShop<ShopOrder>({ action: 'shop-sync-order', order_no: orderNo }),
  // 只取自己的流水（管理员按策略能看到所有人的，所以这里显式按用户过滤）
  async ledger(userId: string, limit = 30): Promise<LedgerEntry[]> {
    const { data, error } = await supabase.from('ai_credit_ledger')
      .select('id, delta, balance_after, reason, note, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error('积分明细暂时读不到，请稍后再试。');
    return (data || []) as LedgerEntry[];
  },
};
