type ParsedLine = {
  productLabel?: string;
  skuLabel?: string;
  color?: string;
  size?: string;
  quantity?: number;
};

export type ParsedImageFormData = {
  note?: string;
  recordedAt?: string;
  manufacturerName?: string;
  lines: ParsedLine[];
};

type MoonshotChoice = {
  message?: {
    content?: string;
  };
};

type MoonshotResponse = {
  choices?: MoonshotChoice[];
};

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

function normalizeParsed(input: unknown): ParsedImageFormData {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const rawLines = Array.isArray(obj.lines) ? obj.lines : [];
  const lines: ParsedLine[] = rawLines
    .map((x) => {
      const r = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      const quantityRaw = Number(r.quantity);
      return {
        productLabel: typeof r.productLabel === "string" ? r.productLabel.trim() : undefined,
        skuLabel: typeof r.skuLabel === "string" ? r.skuLabel.trim() : undefined,
        color: typeof r.color === "string" ? r.color.trim() : undefined,
        size: typeof r.size === "string" ? r.size.trim() : undefined,
        quantity: Number.isFinite(quantityRaw) ? Math.max(0, Math.round(quantityRaw)) : undefined,
      };
    })
    .filter((l) => (l.skuLabel || (l.color && l.size)) && (l.quantity ?? 0) > 0);

  return {
    note: typeof obj.note === "string" ? obj.note.trim() : undefined,
    recordedAt: typeof obj.recordedAt === "string" ? obj.recordedAt.trim() : undefined,
    manufacturerName:
      typeof obj.manufacturerName === "string" ? obj.manufacturerName.trim() : undefined,
    lines,
  };
}

export async function parseImageWithMoonshot(args: {
  imageUrl?: string;
  imageDataUrl?: string;
  mode: "inbound" | "shipment";
}): Promise<ParsedImageFormData | null> {
  const apiKey = process.env.MOONSHOT_API_KEY?.trim();
  if (!apiKey) return null;

  const prompt =
    args.mode === "shipment"
      ? "你是发货单据识别助手。请识别图片并只返回 JSON。厂家名优先从图片最上方标题提取：若出现“xxx销售单”，则 manufacturerName 必须取“销售单”前面的 xxx（去掉空格与无关符号）。字段：manufacturerName(字符串,可空)、recordedAt(ISO时间字符串,可空)、note(字符串,可空)、lines(数组)。lines 每项字段：productLabel(可空)、skuLabel(可空)、color(可空)、size(可空)、quantity(正整数)。不要返回任何解释文字。"
      : "你是入库单据识别助手。请识别图片并只返回 JSON。厂家名优先从图片最上方标题提取：若出现“xxx销售单”，则 manufacturerName 必须取“销售单”前面的 xxx（去掉空格与无关符号）。字段：manufacturerName(字符串,可空)、recordedAt(ISO时间字符串,可空)、note(字符串,可空)、lines(数组)。lines 每项字段：productLabel(可空)、skuLabel(可空)、color(可空)、size(可空)、quantity(正整数)。不要返回任何解释文字。";

  const resp = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "moonshot-v1-8k-vision-preview",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你只输出合法 JSON，不要输出任何其他文本。" },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: args.imageDataUrl?.trim() || args.imageUrl || "" },
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Moonshot parse failed: ${resp.status} ${text}`);
  }
  const json = (await resp.json()) as MoonshotResponse;
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) return null;

  const parsedText = extractJsonObject(content);
  try {
    const parsed = JSON.parse(parsedText) as unknown;
    return normalizeParsed(parsed);
  } catch {
    return null;
  }
}
