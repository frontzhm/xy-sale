import { createHash, randomBytes } from "node:crypto";

type CachedValue = {
  value: string;
  expiresAtMs: number;
};

type WechatAccessTokenResp = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type WechatJsapiTicketResp = {
  ticket?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const WECHAT_API_BASE = "https://api.weixin.qq.com";

let accessTokenCache: CachedValue | null = null;
let jsapiTicketCache: CachedValue | null = null;

function nowMs(): number {
  return Date.now();
}

function cacheStillValid(cache: CachedValue | null): cache is CachedValue {
  return !!cache && cache.expiresAtMs > nowMs();
}

function getWechatEnv() {
  const appId = process.env.WX_APP_ID?.trim();
  const appSecret = process.env.WX_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error("缺少微信配置：请设置 WX_APP_ID 与 WX_APP_SECRET");
  }
  return { appId, appSecret };
}

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`微信接口请求失败（${resp.status}）：${text || "未知错误"}`);
  }
  return (await resp.json()) as T;
}

async function getAccessToken(): Promise<string> {
  if (cacheStillValid(accessTokenCache)) return accessTokenCache.value;

  const { appId, appSecret } = getWechatEnv();
  const url =
    `${WECHAT_API_BASE}/cgi-bin/token` +
    `?grant_type=client_credential&appid=${encodeURIComponent(appId)}` +
    `&secret=${encodeURIComponent(appSecret)}`;
  const data = await fetchJson<WechatAccessTokenResp>(url);

  if (!data.access_token || !data.expires_in || data.errcode) {
    throw new Error(`获取 access_token 失败：${data.errmsg || `errcode=${String(data.errcode ?? "")}`}`);
  }

  const ttlMs = Math.max(0, data.expires_in * 1000 - TOKEN_REFRESH_BUFFER_MS);
  accessTokenCache = {
    value: data.access_token,
    expiresAtMs: nowMs() + ttlMs,
  };
  return data.access_token;
}

async function getJsapiTicket(): Promise<string> {
  if (cacheStillValid(jsapiTicketCache)) return jsapiTicketCache.value;

  const accessToken = await getAccessToken();
  const url =
    `${WECHAT_API_BASE}/cgi-bin/ticket/getticket` +
    `?access_token=${encodeURIComponent(accessToken)}&type=jsapi`;
  const data = await fetchJson<WechatJsapiTicketResp>(url);

  if (!data.ticket || !data.expires_in || data.errcode) {
    throw new Error(`获取 jsapi_ticket 失败：${data.errmsg || `errcode=${String(data.errcode ?? "")}`}`);
  }

  const ttlMs = Math.max(0, data.expires_in * 1000 - TOKEN_REFRESH_BUFFER_MS);
  jsapiTicketCache = {
    value: data.ticket,
    expiresAtMs: nowMs() + ttlMs,
  };
  return data.ticket;
}

export type JsSdkSignaturePayload = {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
};

export async function createWechatJsSdkSignature(url: string): Promise<JsSdkSignaturePayload> {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    throw new Error("缺少 url 参数");
  }
  const { appId } = getWechatEnv();
  const jsapiTicket = await getJsapiTicket();
  const nonceStr = randomBytes(8).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000);
  const raw = `jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${normalizedUrl}`;
  const signature = createHash("sha1").update(raw).digest("hex");
  return { appId, timestamp, nonceStr, signature };
}

