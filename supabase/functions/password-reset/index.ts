import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SMS_HOST = "sms.tencentcloudapi.com";
const SMS_SERVICE = "sms";
const SMS_VERSION = "2021-01-11";
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

type RequestBody = {
  action?: "send_code" | "reset_password";
  phone?: string;
  code?: string;
  new_password?: string;
};

type OtpRow = {
  phone: string;
  code_hash: string;
  expires_at: string;
  last_sent_at: string;
  attempts: number;
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new HttpError(503, "验证码服务暂未配置，请稍后再试");
  return value;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return hex(new Uint8Array(digest));
}

async function hmac(
  key: string | Uint8Array,
  value: string,
): Promise<Uint8Array> {
  const rawKey = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(rawKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(value),
  );
  return new Uint8Array(signature);
}

async function codeHash(phone: string, code: string): Promise<string> {
  return hex(await hmac(env("PASSWORD_RESET_CODE_PEPPER"), `${phone}:${code}`));
}

function generateCode(): string {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(100000 + (value[0] % 900000));
}

function requirePhone(value: unknown): string {
  const phone = typeof value === "string" ? value.trim() : "";
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new HttpError(400, "请输入有效的中国大陆手机号");
  }
  return phone;
}

function requireCode(value: unknown): string {
  const code = typeof value === "string" ? value.trim() : "";
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, "请输入 6 位验证码");
  return code;
}

function requirePassword(value: unknown): string {
  const password = typeof value === "string" ? value : "";
  if (password.length < 6) throw new HttpError(400, "密码长度至少为 6 位");
  return password;
}

function createServiceClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function sendTencentSms(phone: string, code: string): Promise<void> {
  const secretId = env("TENCENTCLOUD_SECRET_ID");
  const secretKey = env("TENCENTCLOUD_SECRET_KEY");
  const body = JSON.stringify({
    PhoneNumberSet: [`+86${phone}`],
    SmsSdkAppId: env("TENCENTCLOUD_SMS_SDK_APP_ID"),
    SignName: env("TENCENTCLOUD_SMS_SIGN_NAME"),
    TemplateId: env("TENCENTCLOUD_SMS_VERIFICATION_TEMPLATE_ID"),
    TemplateParamSet: [code, "10"],
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const date = new Date(Number(timestamp) * 1000).toISOString().slice(0, 10);
  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\nhost:${SMS_HOST}\nx-tc-action:sendsms\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest =
    `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${await sha256(body)}`;
  const credentialScope = `${date}/${SMS_SERVICE}/tc3_request`;
  const stringToSign =
    `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${await sha256(
      canonicalRequest,
    )}`;
  const secretDate = await hmac(`TC3${secretKey}`, date);
  const secretService = await hmac(secretDate, SMS_SERVICE);
  const secretSigning = await hmac(secretService, "tc3_request");
  const signature = hex(await hmac(secretSigning, stringToSign));
  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${SMS_HOST}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json; charset=utf-8",
      Host: SMS_HOST,
      "X-TC-Action": "SendSms",
      "X-TC-Version": SMS_VERSION,
      "X-TC-Region": Deno.env.get("TENCENTCLOUD_REGION")?.trim() ||
        "ap-guangzhou",
      "X-TC-Timestamp": timestamp,
    },
    body,
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {
    // The public response remains generic; diagnostics stay in the function log.
  }
  const apiError = payload.Response as
    | { Error?: { Code?: string } }
    | undefined;
  const statuses = payload.Response as {
    SendStatusSet?: Array<{ Code?: string }>;
  } | undefined;
  if (
    !response.ok || apiError?.Error ||
    statuses?.SendStatusSet?.[0]?.Code !== "Ok"
  ) {
    console.error(
      "[password-reset] Tencent SMS rejected:",
      response.status,
      apiError?.Error?.Code,
      statuses?.SendStatusSet?.[0]?.Code,
    );
    throw new HttpError(502, "验证码发送失败，请稍后再试");
  }
}

async function sendCode(phone: string) {
  const service = createServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (profileError) throw profileError;

  // Return the same response for unknown numbers so this endpoint cannot be
  // used to enumerate community accounts.
  if (!profile) return { message: "若该手机号已注册，验证码将发送至该手机" };

  const { data: current, error: currentError } = await service
    .from("password_reset_otps")
    .select("phone, code_hash, expires_at, last_sent_at, attempts")
    .eq("phone", phone)
    .maybeSingle();
  if (currentError) throw currentError;

  const elapsed = current
    ? Date.now() - Date.parse((current as OtpRow).last_sent_at)
    : Number.POSITIVE_INFINITY;
  if (elapsed < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    throw new HttpError(429, `请在 ${waitSeconds} 秒后再试`);
  }

  const code = generateCode();
  const hash = await codeHash(phone, code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const { error: upsertError } = await service.from("password_reset_otps")
    .upsert({
      phone,
      code_hash: hash,
      expires_at: expiresAt,
      last_sent_at: new Date().toISOString(),
      attempts: 0,
    }, { onConflict: "phone" });
  if (upsertError) throw upsertError;

  try {
    await sendTencentSms(phone, code);
  } catch (error) {
    await service.from("password_reset_otps").delete().eq("phone", phone).eq(
      "code_hash",
      hash,
    );
    throw error;
  }

  return { message: "验证码已发送，请注意查收" };
}

async function resetPassword(phone: string, code: string, newPassword: string) {
  const service = createServiceClient();
  const { data: otp, error: otpError } = await service
    .from("password_reset_otps")
    .select("phone, code_hash, expires_at, last_sent_at, attempts")
    .eq("phone", phone)
    .maybeSingle();
  if (otpError) throw otpError;

  const record = otp as OtpRow | null;
  if (!record || Date.parse(record.expires_at) <= Date.now()) {
    if (record) {
      await service.from("password_reset_otps").delete().eq("phone", phone);
    }
    throw new HttpError(400, "验证码已过期，请重新获取");
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await service.from("password_reset_otps").delete().eq("phone", phone);
    throw new HttpError(429, "验证次数过多，请重新获取验证码");
  }

  if (record.code_hash !== await codeHash(phone, code)) {
    const attempts = record.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await service.from("password_reset_otps").delete().eq("phone", phone);
    } else {
      await service.from("password_reset_otps").update({ attempts }).eq(
        "phone",
        phone,
      );
    }
    throw new HttpError(400, "验证码不正确");
  }

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (profileError || !profile) {
    throw new HttpError(400, "验证码已失效，请重新获取");
  }

  const { error: updateError } = await service.auth.admin.updateUserById(
    profile.id,
    { password: newPassword },
  );
  if (updateError) {
    console.error(
      "[password-reset] Auth password update failed:",
      updateError.message,
    );
    throw new HttpError(500, "密码重置失败，请稍后再试");
  }

  const { error: deleteError } = await service.from("password_reset_otps")
    .delete().eq("phone", phone);
  if (deleteError) {
    console.error(
      "[password-reset] Failed to clear used code:",
      deleteError.message,
    );
  }
  return { message: "密码重置成功，请使用新密码登录" };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "仅支持 POST 请求" }, 405);

  try {
    const body = await req.json() as RequestBody;
    const phone = requirePhone(body.phone);
    if (body.action === "send_code") return json(await sendCode(phone));
    if (body.action === "reset_password") {
      return json(
        await resetPassword(
          phone,
          requireCode(body.code),
          requirePassword(body.new_password),
        ),
      );
    }
    throw new HttpError(400, "请求无效");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError
      ? error.message
      : "服务暂时不可用，请稍后再试";
    if (!(error instanceof HttpError)) {
      console.error("[password-reset] Unexpected error:", error);
    }
    return json({ error: message }, status);
  }
});
