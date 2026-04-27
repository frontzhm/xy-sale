import { NextRequest, NextResponse } from "next/server";

import { createWechatJsSdkSignature } from "@/lib/wechat/jssdk";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = String(searchParams.get("url") ?? "").trim();
    if (!url) {
      return NextResponse.json(
        { success: false, error: "缺少 url 参数（请传当前页面地址，且不含 hash）" },
        { status: 400 },
      );
    }

    const data = await createWechatJsSdkSignature(url);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成微信 JSSDK 签名失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

