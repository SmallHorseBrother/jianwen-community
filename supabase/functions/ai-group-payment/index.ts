import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WECHAT_API_BASE = 'https://api.mch.weixin.qq.com';
const ORDER_TTL_MINUTES = 30;
const DEFAULT_UNLOCK_PRICE_CENTS = 1990;

type Provider = 'wechat' | 'alipay';

type MembershipRow = {
  id: string;
  user_id: string;
  route_level: 'starter' | 'application' | 'practice';
  access_status: 'pending_payment' | 'active' | 'revoked';
  display_id: string | null;
  activated_at: string | null;
};

type RouteRow = {
  level: MembershipRow['route_level'];
  group_name: string;
  id_prefix: string;
  description: string;
  qr_storage_path: string | null;
};

type OrderRow = {
  id: string;
  user_id: string;
  membership_id: string;
  order_no: string;
  provider: Provider;
  amount_cents: number;
  subject: string;
  status: 'pending' | 'created' | 'paid' | 'expired' | 'failed';
  provider_status: string | null;
  provider_trade_no: string | null;
  provider_code_url: string | null;
  provider_payment_url: string | null;
  expires_at: string;
  created_at: string;
};

type WechatConfig = {
  appId: string;
  mchId: string;
  merchantSerialNo: string;
  apiV3Key: string;
  privateKey: string;
  platformPublicKey: string;
  notifyUrl: string;
};

type AlipayConfig = {
  appId: string;
  gateway: string;
  privateKey: string;
  publicKey: string;
  notifyUrl: string;
  returnUrl: string;
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new HttpError(503, `缺少服务端配置：${name}`);
  return value;
}

function optionalEnv(name: string): string | null {
  return Deno.env.get(name)?.trim() || null;
}

function defaultKeyFromDictionary(name: 'SUPABASE_PUBLISHABLE_KEYS' | 'SUPABASE_SECRET_KEYS'): string | null {
  const raw = optionalEnv(name);
  if (!raw) return null;
  try {
    const values = JSON.parse(raw) as Record<string, unknown>;
    return typeof values.default === 'string' && values.default.trim() ? values.default.trim() : null;
  } catch {
    return null;
  }
}

function getSupabasePublishableKey() {
  const key = defaultKeyFromDictionary('SUPABASE_PUBLISHABLE_KEYS')
    || optionalEnv('SUPABASE_ANON_KEY');
  if (!key) throw new HttpError(503, '缺少 Supabase publishable key');
  return key;
}

function getSupabaseSecretKey() {
  const key = defaultKeyFromDictionary('SUPABASE_SECRET_KEYS')
    || optionalEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new HttpError(503, '缺少 Supabase secret key');
  return key;
}

function createServiceClient() {
  return createClient(env('SUPABASE_URL'), getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireUser(req: Request) {
  const authorization = req.headers.get('authorization');
  if (!authorization) throw new HttpError(401, '请先登录');

  const client = createClient(env('SUPABASE_URL'), getSupabasePublishableKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, '登录状态已失效，请重新登录');
  return data.user;
}

function getPriceCents(): number | null {
  const value = optionalEnv('AI_GROUP_UNLOCK_PRICE_CENTS');
  if (!value) return DEFAULT_UNLOCK_PRICE_CENTS;
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : null;
}

function isWechatConfigured() {
  return [
    'AI_GROUP_WECHAT_APP_ID',
    'AI_GROUP_WECHAT_MCH_ID',
    'AI_GROUP_WECHAT_MERCHANT_SERIAL_NO',
    'AI_GROUP_WECHAT_API_V3_KEY',
    'AI_GROUP_WECHAT_PRIVATE_KEY',
    'AI_GROUP_WECHAT_PLATFORM_PUBLIC_KEY',
  ].every((name) => Boolean(optionalEnv(name)));
}

function isAlipayConfigured() {
  return [
    'AI_GROUP_ALIPAY_APP_ID',
    'AI_GROUP_ALIPAY_PRIVATE_KEY',
    'AI_GROUP_ALIPAY_PUBLIC_KEY',
    'AI_GROUP_PAYMENT_RETURN_URL',
  ].every((name) => Boolean(optionalEnv(name)));
}

function paymentCallbackUrl(action: 'wechat-notify' | 'alipay-notify') {
  const base = optionalEnv('AI_GROUP_PAYMENT_CALLBACK_BASE_URL')
    || `${env('SUPABASE_URL').replace(/\/$/, '')}/functions/v1/ai-group-payment`;
  const callback = new URL(base);
  callback.search = '';
  callback.hash = '';
  callback.pathname = `${callback.pathname.replace(/\/$/, '')}/${action}`;
  return callback.toString();
}

function getWechatConfig(): WechatConfig {
  const apiV3Key = env('AI_GROUP_WECHAT_API_V3_KEY');
  if (new TextEncoder().encode(apiV3Key).length !== 32) {
    throw new HttpError(503, 'AI_GROUP_WECHAT_API_V3_KEY 必须为 32 字节');
  }
  return {
    appId: env('AI_GROUP_WECHAT_APP_ID'),
    mchId: env('AI_GROUP_WECHAT_MCH_ID'),
    merchantSerialNo: env('AI_GROUP_WECHAT_MERCHANT_SERIAL_NO'),
    apiV3Key,
    privateKey: env('AI_GROUP_WECHAT_PRIVATE_KEY'),
    platformPublicKey: env('AI_GROUP_WECHAT_PLATFORM_PUBLIC_KEY'),
    notifyUrl: paymentCallbackUrl('wechat-notify'),
  };
}

function getAlipayConfig(): AlipayConfig {
  return {
    appId: env('AI_GROUP_ALIPAY_APP_ID'),
    gateway: optionalEnv('AI_GROUP_ALIPAY_GATEWAY') || 'https://openapi.alipay.com/gateway.do',
    privateKey: env('AI_GROUP_ALIPAY_PRIVATE_KEY'),
    publicKey: env('AI_GROUP_ALIPAY_PUBLIC_KEY'),
    notifyUrl: paymentCallbackUrl('alipay-notify'),
    returnUrl: env('AI_GROUP_PAYMENT_RETURN_URL'),
  };
}

function bytesFromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Deno's newer typed-array definitions allow SharedArrayBuffer in the
  // generic parameter while Web Crypto only accepts ArrayBuffer-backed views.
  // Copying also keeps private-key bytes out of a potentially shared buffer.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function pemToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\\n/g, '\n').trim();
  const body = normalized
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s/g, '');
  if (!body) throw new HttpError(503, '支付 RSA 密钥格式无效');
  return bytesFromBase64(body);
}

async function importPrivateKey(pem: string) {
  return crypto.subtle.importKey(
    'pkcs8',
    toArrayBuffer(pemToBytes(pem)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function importPublicKey(pem: string) {
  return crypto.subtle.importKey(
    'spki',
    toArrayBuffer(pemToBytes(pem)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

async function rsaSign(privateKey: string, payload: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    await importPrivateKey(privateKey),
    new TextEncoder().encode(payload),
  );
  return base64FromBytes(new Uint8Array(signature));
}

async function rsaVerify(publicKey: string, payload: string, signature: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      await importPublicKey(publicKey),
      toArrayBuffer(bytesFromBase64(signature)),
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}

function randomHex(bytes = 5): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function makeOrderNo(): string {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `AI${timestamp}${randomHex(5)}`;
}

function amountToYuan(amountCents: number) {
  return `${Math.floor(amountCents / 100)}.${String(amountCents % 100).padStart(2, '0')}`;
}

function formatWechatTimeExpire(value: string) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new HttpError(500, '订单有效期格式无效');
  const chinaTime = new Date(timestamp.getTime() + 8 * 60 * 60 * 1000);
  return chinaTime.toISOString().replace(/\.\d{3}Z$/, '+08:00');
}

function yuanToCents(value: unknown) {
  const parsed = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(parsed)) return 0;
  const [yuan, fraction = ''] = parsed.split('.');
  return Number(yuan) * 100 + Number(`${fraction}00`.slice(0, 2));
}

function alipayTimestamp() {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date())
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function canonicalAlipayParams(params: Record<string, string>, exclude: string[] = ['sign']) {
  return Object.keys(params)
    .filter((key) => !exclude.includes(key) && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

// Alipay signs the exact raw JSON value of the response field. JSON.parse() and
// JSON.stringify() can change whitespace or key order, so retain that fragment
// when validating a manual status query.
function extractTopLevelJsonValue(raw: string, property: string): string | null {
  const propertyIndex = raw.indexOf(`"${property}"`);
  if (propertyIndex < 0) return null;
  const colon = raw.indexOf(':', propertyIndex + property.length + 2);
  if (colon < 0) return null;
  let start = colon + 1;
  while (/\s/.test(raw[start] || '')) start += 1;
  if (raw[start] !== '{' && raw[start] !== '[' && raw[start] !== '"') return null;

  const opening = raw[start];
  if (opening === '"') {
    let escaped = false;
    for (let index = start + 1; index < raw.length; index += 1) {
      if (!escaped && raw[index] === '"') return raw.slice(start, index + 1);
      escaped = !escaped && raw[index] === '\\';
      if (raw[index] !== '\\') escaped = false;
    }
    return null;
  }

  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (!escaped && char === '"') inString = false;
      escaped = !escaped && char === '\\';
      if (char !== '\\') escaped = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === opening) depth += 1;
    if (char === closing) {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return null;
}

async function signedAlipayUrl(config: AlipayConfig, method: string, bizContent: Record<string, unknown>, options?: {
  notify?: boolean;
  return?: boolean;
}) {
  const params: Record<string, string> = {
    app_id: config.appId,
    method,
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: alipayTimestamp(),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  if (options?.notify) params.notify_url = config.notifyUrl;
  if (options?.return) params.return_url = config.returnUrl;
  params.sign = await rsaSign(config.privateKey, canonicalAlipayParams(params));
  return `${config.gateway}${config.gateway.includes('?') ? '&' : '?'}${new URLSearchParams(params).toString()}`;
}

async function wechatRequest(config: WechatConfig, method: string, path: string, body = '') {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomHex(16);
  const signingPayload = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = await rsaSign(config.privateKey, signingPayload);
  const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.merchantSerialNo}"`;
  const response = await fetch(`${WECHAT_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body } : {}),
  });
  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* provider error body is not always JSON */ }
  if (!response.ok) {
    const code = typeof payload.code === 'string' ? payload.code.trim() : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    const detail = [code, message].filter(Boolean).join('：');
    throw new HttpError(502, detail
      ? `微信支付请求失败：${detail}`
      : `微信支付请求失败（${response.status}）`);
  }
  return payload;
}

async function createWechatOrder(config: WechatConfig, order: OrderRow) {
  const body = JSON.stringify({
    appid: config.appId,
    mchid: config.mchId,
    description: order.subject,
    out_trade_no: order.order_no,
    notify_url: config.notifyUrl,
    time_expire: formatWechatTimeExpire(order.expires_at),
    amount: { total: order.amount_cents, currency: 'CNY' },
  });
  const payload = await wechatRequest(config, 'POST', '/v3/pay/transactions/native', body);
  const codeUrl = typeof payload.code_url === 'string' ? payload.code_url : '';
  if (!codeUrl) throw new HttpError(502, '微信支付没有返回扫码链接');
  return codeUrl;
}

async function decryptWechatResource(config: WechatConfig, resource: Record<string, unknown>) {
  const ciphertext = typeof resource.ciphertext === 'string' ? resource.ciphertext : '';
  const nonce = typeof resource.nonce === 'string' ? resource.nonce : '';
  const associatedData = typeof resource.associated_data === 'string' ? resource.associated_data : '';
  if (!ciphertext || !nonce) throw new HttpError(400, '微信支付回调缺少加密资源');
  const key = await crypto.subtle.importKey(
    'raw', toArrayBuffer(new TextEncoder().encode(config.apiV3Key)), { name: 'AES-GCM' }, false, ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt({
    name: 'AES-GCM',
    iv: new TextEncoder().encode(nonce),
    additionalData: new TextEncoder().encode(associatedData),
  }, key, toArrayBuffer(bytesFromBase64(ciphertext)));
  return JSON.parse(new TextDecoder().decode(plain)) as Record<string, unknown>;
}

async function getMembershipStatus(service: ReturnType<typeof createServiceClient>, userId: string) {
  const { data: assessment, error: assessmentError } = await service
    .from('ai_assessments').select('score, level, learning_goal, updated_at').eq('user_id', userId).maybeSingle();
  if (assessmentError) throw assessmentError;
  if (!assessment) return { assessment: null, membership: null, route: null, latestOrder: null, qrUrl: null };

  const { data: membership, error: membershipError } = await service
    .from('ai_group_memberships')
    .select('id, user_id, route_level, access_status, display_id, activated_at')
    .eq('user_id', userId).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return { assessment, membership: null, route: null, latestOrder: null, qrUrl: null };

  const { data: route, error: routeError } = await service
    .from('ai_group_routes')
    .select('level, group_name, id_prefix, description, qr_storage_path')
    .eq('level', membership.route_level).single();
  if (routeError) throw routeError;

  const { data: latestOrder, error: orderError } = await service
    .from('ai_group_orders')
    .select('id, user_id, membership_id, order_no, provider, amount_cents, status, provider_status, provider_trade_no, provider_code_url, provider_payment_url, expires_at, created_at')
    .eq('membership_id', membership.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (orderError) throw orderError;

  let qrUrl: string | null = null;
  if (membership.access_status === 'active' && route.qr_storage_path) {
    const { data, error } = await service.storage.from('ai-group-qr').createSignedUrl(route.qr_storage_path, 600);
    if (error) throw error;
    qrUrl = data.signedUrl;
  }
  return {
    assessment,
    membership: membership as MembershipRow,
    route: route as RouteRow,
    latestOrder: latestOrder as OrderRow | null,
    qrUrl,
  };
}

function statusPayload(status: Awaited<ReturnType<typeof getMembershipStatus>>) {
  const priceCents = getPriceCents();
  return {
    assessment: status.assessment,
    membership: status.membership && {
      level: status.membership.route_level,
      access_status: status.membership.access_status,
      display_id: status.membership.access_status === 'active' ? status.membership.display_id : null,
      activated_at: status.membership.activated_at,
    },
    route: status.route && {
      level: status.route.level,
      group_name: status.route.group_name,
      description: status.route.description,
    },
    latest_order: status.latestOrder && {
      order_no: status.latestOrder.order_no,
      provider: status.latestOrder.provider,
      status: status.latestOrder.status,
      expires_at: status.latestOrder.expires_at,
      wechat_code_url: status.latestOrder.provider === 'wechat' ? status.latestOrder.provider_code_url : null,
    },
    group_qr_url: status.membership?.access_status === 'active' ? status.qrUrl : null,
    qr_ready: Boolean(status.membership?.access_status === 'active' && status.qrUrl),
    unlock_price_cents: priceCents,
    unlock_price_label: '早鸟价',
    payment_available: Boolean(priceCents && (isWechatConfigured() || isAlipayConfigured())),
    providers: {
      wechat: Boolean(priceCents && isWechatConfigured()),
      alipay: Boolean(priceCents && isAlipayConfigured()),
    },
  };
}

async function getOwnOrder(service: ReturnType<typeof createServiceClient>, userId: string, orderNo: string) {
  const { data, error } = await service
    .from('ai_group_orders')
    .select('id, user_id, membership_id, order_no, provider, amount_cents, status, provider_status, provider_trade_no, provider_code_url, provider_payment_url, expires_at, created_at')
    .eq('order_no', orderNo).eq('user_id', userId).single();
  if (error || !data) throw new HttpError(404, '订单不存在');
  return data as OrderRow;
}

async function fulfilOrder(
  service: ReturnType<typeof createServiceClient>,
  order: OrderRow,
  providerStatus: string,
  providerTradeNo: string,
  payload: Record<string, unknown>,
) {
  const { error } = await service.rpc('complete_ai_group_order', {
    p_order_no: order.order_no,
    p_provider: order.provider,
    p_provider_trade_no: providerTradeNo,
    p_provider_status: providerStatus,
    p_paid_at: new Date().toISOString(),
    p_provider_payload: payload,
  });
  if (error) throw error;
}

async function createOrder(service: ReturnType<typeof createServiceClient>, userId: string, provider: Provider) {
  const priceCents = getPriceCents();
  if (!priceCents) throw new HttpError(503, '入群价格尚未设置，暂时无法支付');
  if (provider === 'wechat' && !isWechatConfigured()) throw new HttpError(503, '微信支付尚未配置');
  if (provider === 'alipay' && !isAlipayConfigured()) throw new HttpError(503, '支付宝支付尚未配置');

  const status = await getMembershipStatus(service, userId);
  if (!status.assessment || !status.membership) throw new HttpError(409, '请先完成 AI 学习起点测评');
  if (status.membership.access_status === 'active') return { alreadyActive: true, status };

  const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000).toISOString();
  const pending = {
    user_id: userId,
    membership_id: status.membership.id,
    order_no: makeOrderNo(),
    provider,
    amount_cents: priceCents,
    subject: 'AI 学习群入群权益',
    status: 'pending',
    expires_at: expiresAt,
  };
  const { data: created, error: insertError } = await service
    .from('ai_group_orders').insert(pending).select('*').single();
  if (insertError || !created) throw insertError || new Error('创建订单失败');
  const order = created as OrderRow;

  try {
    if (provider === 'wechat') {
      const codeUrl = await createWechatOrder(getWechatConfig(), order);
      const { data, error } = await service.from('ai_group_orders')
        .update({ status: 'created', provider_code_url: codeUrl })
        .eq('id', order.id).select('*').single();
      if (error || !data) throw error || new Error('保存微信支付订单失败');
      return { order: data as OrderRow, alreadyActive: false };
    }

    const paymentUrl = await signedAlipayUrl(getAlipayConfig(), 'alipay.trade.page.pay', {
      out_trade_no: order.order_no,
      total_amount: amountToYuan(order.amount_cents),
      subject: order.subject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
    }, { notify: true, return: true });
    const { data, error } = await service.from('ai_group_orders')
      .update({ status: 'created', provider_payment_url: paymentUrl })
      .eq('id', order.id).select('*').single();
    if (error || !data) throw error || new Error('保存支付宝订单失败');
    return { order: data as OrderRow, alreadyActive: false };
  } catch (error) {
    await service.from('ai_group_orders').update({ status: 'failed' }).eq('id', order.id);
    throw error;
  }
}

async function syncOrder(service: ReturnType<typeof createServiceClient>, userId: string, orderNo: string) {
  const order = await getOwnOrder(service, userId, orderNo);
  if (order.status === 'paid') return getMembershipStatus(service, userId);

  if (order.provider === 'wechat') {
    const config = getWechatConfig();
    const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(order.order_no)}?mchid=${encodeURIComponent(config.mchId)}`;
    const state = await wechatRequest(config, 'GET', path);
    const amount = state.amount as Record<string, unknown> | undefined;
    if (state.trade_state === 'SUCCESS' && Number(amount?.total) === order.amount_cents) {
      await fulfilOrder(service, order, 'SUCCESS', String(state.transaction_id || ''), {
        trade_state: 'SUCCESS', transaction_id: String(state.transaction_id || ''),
      });
    }
  } else {
    const config = getAlipayConfig();
    const requestUrl = await signedAlipayUrl(config, 'alipay.trade.query', { out_trade_no: order.order_no });
    const response = await fetch(requestUrl);
    if (!response.ok) throw new HttpError(502, `支付宝订单查询失败（${response.status}）`);
    const rawResponse = await response.text();
    const envelope = JSON.parse(rawResponse) as Record<string, unknown>;
    const signedState = extractTopLevelJsonValue(rawResponse, 'alipay_trade_query_response');
    const responseSignature = typeof envelope.sign === 'string' ? envelope.sign : '';
    if (!signedState || !responseSignature || !await rsaVerify(config.publicKey, signedState, responseSignature)) {
      throw new HttpError(502, '支付宝订单查询验签失败');
    }
    const state = envelope.alipay_trade_query_response as Record<string, unknown> | undefined;
    const paid = state?.trade_status === 'TRADE_SUCCESS' || state?.trade_status === 'TRADE_FINISHED';
    if (paid && yuanToCents(state?.total_amount) === order.amount_cents) {
      await fulfilOrder(service, order, String(state?.trade_status), String(state?.trade_no || ''), {
        trade_status: String(state?.trade_status), trade_no: String(state?.trade_no || ''),
      });
    }
  }
  return getMembershipStatus(service, userId);
}

async function handleWechatNotify(req: Request) {
  const config = getWechatConfig();
  const rawBody = await req.text();
  const timestamp = req.headers.get('Wechatpay-Timestamp') || '';
  const nonce = req.headers.get('Wechatpay-Nonce') || '';
  const signature = req.headers.get('Wechatpay-Signature') || '';
  if (!timestamp || !nonce || !signature) throw new HttpError(400, '微信支付回调缺少验签信息');
  const signedPayload = `${timestamp}\n${nonce}\n${rawBody}\n`;
  if (!await rsaVerify(config.platformPublicKey, signedPayload, signature)) {
    throw new HttpError(401, '微信支付回调验签失败');
  }

  const envelope = JSON.parse(rawBody) as { resource?: Record<string, unknown> };
  const state = await decryptWechatResource(config, envelope.resource || {});
  const orderNo = String(state.out_trade_no || '');
  const amount = state.amount as Record<string, unknown> | undefined;
  if (!orderNo || state.trade_state !== 'SUCCESS') throw new HttpError(400, '微信支付回调不是成功订单');
  if (String(state.mchid || '') !== config.mchId || String(state.appid || '') !== config.appId) {
    throw new HttpError(400, '微信支付回调商户信息不匹配');
  }

  const service = createServiceClient();
  const { data, error } = await service.from('ai_group_orders').select('*').eq('order_no', orderNo).single();
  if (error || !data) throw new HttpError(404, '订单不存在');
  const order = data as OrderRow;
  if (Number(amount?.total) !== order.amount_cents) throw new HttpError(400, '微信支付回调金额不匹配');
  await fulfilOrder(service, order, 'SUCCESS', String(state.transaction_id || ''), {
    trade_state: 'SUCCESS', transaction_id: String(state.transaction_id || ''),
  });
  return json({ code: 'SUCCESS', message: '成功' });
}

async function handleAlipayNotify(req: Request) {
  const config = getAlipayConfig();
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => { if (typeof value === 'string') params[key] = value; });
  const signature = params.sign || '';
  if (!signature || params.app_id !== config.appId) throw new HttpError(400, '支付宝回调参数无效');
  if (!await rsaVerify(config.publicKey, canonicalAlipayParams(params, ['sign', 'sign_type']), signature)) {
    throw new HttpError(401, '支付宝回调验签失败');
  }
  if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(params.trade_status || '')) {
    return text('success');
  }

  const service = createServiceClient();
  const { data, error } = await service.from('ai_group_orders').select('*').eq('order_no', params.out_trade_no).single();
  if (error || !data) throw new HttpError(404, '订单不存在');
  const order = data as OrderRow;
  if (yuanToCents(params.total_amount) !== order.amount_cents) throw new HttpError(400, '支付宝回调金额不匹配');
  await fulfilOrder(service, order, params.trade_status, params.trade_no || '', {
    trade_status: params.trade_status, trade_no: params.trade_no || '',
  });
  return text('success');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: '仅支持 POST 请求' }, 405);

  try {
    const requestUrl = new URL(req.url);
    const pathAction = requestUrl.pathname.split('/').filter(Boolean).at(-1);
    const action = requestUrl.searchParams.get('action') || pathAction;
    if (action === 'wechat-notify') return await handleWechatNotify(req);
    if (action === 'alipay-notify') return await handleAlipayNotify(req);

    const user = await requireUser(req);
    const body = await req.json() as { action?: string; provider?: Provider; order_no?: string };
    const service = createServiceClient();

    if (body.action === 'status') {
      return json(statusPayload(await getMembershipStatus(service, user.id)));
    }
    if (body.action === 'create-order') {
      if (body.provider !== 'wechat' && body.provider !== 'alipay') throw new HttpError(400, '请选择微信或支付宝');
      const result = await createOrder(service, user.id, body.provider);
      if (result.alreadyActive) return json(statusPayload(result.status!));
      return json({
        order_no: result.order!.order_no,
        provider: result.order!.provider,
        expires_at: result.order!.expires_at,
        wechat_code_url: result.order!.provider_code_url,
        alipay_payment_url: result.order!.provider_payment_url,
      }, 201);
    }
    if (body.action === 'sync-order') {
      if (!body.order_no) throw new HttpError(400, '缺少订单号');
      return json(statusPayload(await syncOrder(service, user.id, body.order_no)));
    }
    throw new HttpError(400, '未知操作');
  } catch (error) {
    console.error('[ai-group-payment]', error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : '服务暂时不可用';
    return json({ error: message }, status);
  }
});
