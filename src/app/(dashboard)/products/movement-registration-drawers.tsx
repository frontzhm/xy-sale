"use client";

import { BetaSchemaForm } from "@ant-design/pro-components";
import type { ProFormColumnsType, ProFormInstance } from "@ant-design/pro-components";
import { Button, Drawer, Spin, Upload, message } from "antd";
import type { UploadFile } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useRef, useState } from "react";

import { createInboundInline } from "../inbound/actions";
import { createShipmentInline } from "../shipments/actions";
import type { ShipmentCatalogProduct } from "../shipments/shipment-form";
import type { ManufacturerOption } from "./product-form";

type InboundDrawerValues = {
  photo?: UploadFile[];
  recordedAt?: Dayjs;
  note?: string;
  lines?: { productName?: string; color?: string; size?: string; quantity?: number }[];
};

type UploadApiSuccess = {
  success: true;
  data: {
    fileName: string;
    url: string;
    mimeType: string | null;
    ai?: {
      note?: string;
      recordedAt?: string;
      manufacturerName?: string;
      orderNo?: string;
      batchNo?: string;
      lines?: {
        productLabel?: string;
        skuLabel?: string;
        color?: string;
        size?: string;
        quantity?: number;
      }[];
    } | null;
    duplicateShipment?: { id: string; recordedAt: string } | null;
    duplicateInbound?: { id: string; recordedAt: string } | null;
  };
};

type UploadApiFail = { success: false; error?: string };

function formatRecordedAtForServer(v: unknown): string {
  if (v == null || v === "") return "";
  if (dayjs.isDayjs(v)) return v.toISOString();
  return String(v);
}

function buildLineSummaryNote(
  lines: Array<{ productName?: string; quantity?: number }>,
): string {
  const items = lines
    .map((r) => {
      const name = String(r.productName ?? "").trim();
      const q = Number(r.quantity);
      return { name, quantity: Number.isFinite(q) ? Math.max(0, Math.round(q)) : 0 };
    })
    .filter((x) => x.name && x.quantity > 0);

  if (items.length === 0) return "";

  const byName = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    total += item.quantity;
    byName.set(item.name, (byName.get(item.name) ?? 0) + item.quantity);
  }

  const linesText = Array.from(byName.entries()).map(([name, qty]) => `${name}：${qty}件`);
  return [`总件数：${total}件`, ...linesText].join("\n");
}

function inboundDrawerValuesToFormData(values: InboundDrawerValues): FormData {
  const fd = new FormData();
  const uploaded = values.photo?.[0];
  const response = uploaded?.response as UploadApiSuccess | UploadApiFail | undefined;
  const aiBatchNo =
    response && response.success ? String(response.data.ai?.batchNo ?? "").trim() : "";
  const summaryNote = buildLineSummaryNote(values.lines ?? []);
  const batchLine = aiBatchNo ? `批次：${aiBatchNo}` : "";
  const rawNote = String(values.note ?? "").trim();
  const noteCore = [batchLine, summaryNote].filter((x) => x).join("\n");
  const note = rawNote ? (noteCore ? `${noteCore}\n\n${rawNote}` : rawNote) : noteCore;
  fd.set("note", note);
  const ra = formatRecordedAtForServer(values.recordedAt);
  if (ra) fd.set("recordedAt", ra);

  const lines = (values.lines ?? [])
    .map((r) => {
      const productName = String(r?.productName ?? "").trim();
      const color = String(r?.color ?? "").trim();
      const size = String(r?.size ?? "").trim();
      const q = r?.quantity;
      const quantity = typeof q === "number" ? q : Number.parseInt(String(q ?? ""), 10);
      return { productName, color, size, quantity };
    })
    .filter((r) => r.productName && r.color && r.size && Number.isInteger(r.quantity) && r.quantity > 0);
  fd.set("linesJson", JSON.stringify(lines));

  const photoUrl = uploaded?.url ?? (response && response.success ? response.data.url : "");
  const photoMimeType =
    response && response.success && response.data.mimeType ? response.data.mimeType : "";
  if (photoUrl) {
    fd.set("photoUrl", photoUrl);
  }
  if (photoMimeType) {
    fd.set("photoMimeType", photoMimeType);
  }
  return fd;
}

function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function bestMatchManufacturerId(
  name: string,
  manufacturers: ManufacturerOption[],
): string | null {
  const target = norm(name);
  if (!target) return null;
  let exact: ManufacturerOption | null = null;
  let fuzzy: ManufacturerOption | null = null;
  for (const m of manufacturers) {
    const n = norm(m.name);
    if (!n) continue;
    if (n === target) {
      exact = m;
      break;
    }
    if (!fuzzy && (n.includes(target) || target.includes(n))) {
      fuzzy = m;
    }
  }
  return exact?.id ?? fuzzy?.id ?? null;
}

function mapAiLinesToFormLines(
  aiLines: NonNullable<UploadApiSuccess["data"]["ai"]>["lines"],
  catalog: ShipmentCatalogProduct[],
): { productName: string; color: string; size: string; quantity: number }[] {
  if (!aiLines || aiLines.length === 0) return [];
  const rows: { productName: string; color: string; size: string; quantity: number }[] = [];
  for (const row of aiLines) {
    const q = Number(row.quantity);
    if (!Number.isFinite(q) || q <= 0) continue;
    const skuLabel = row.skuLabel ? norm(row.skuLabel) : "";
    const color = row.color ? norm(row.color) : "";
    const size = row.size ? norm(row.size) : "";
    const productLabel = row.productLabel ? norm(row.productLabel) : "";
    let hit: { productName: string; color: string; size: string } | null = null;
    for (const p of catalog) {
      if (
        productLabel &&
        !norm(p.label).includes(productLabel) &&
        !productLabel.includes(norm(p.label))
      ) {
        continue;
      }
      for (const s of p.skus) {
        const sNorm = norm(s.label);
        const bySkuLabel = skuLabel && (sNorm.includes(skuLabel) || skuLabel.includes(sNorm));
        const byColorSize = color && size && sNorm.includes(color) && sNorm.includes(size);
        if (bySkuLabel || byColorSize) {
          const parts = s.label.split(/[\/|｜]/).map((x) => x.trim());
          const c = row.color?.trim() || parts[0] || "";
          const z = row.size?.trim() || parts[1] || "";
          hit = { productName: p.label, color: c, size: z };
          break;
        }
      }
      if (hit) break;
    }
    if (hit) {
      rows.push({ ...hit, quantity: Math.max(1, Math.round(q)) });
      continue;
    }
    const fallbackName = row.productLabel?.trim() || "";
    const fallbackColor = row.color?.trim() || "";
    const fallbackSize = row.size?.trim() || "";
    if (fallbackName && fallbackColor && fallbackSize) {
      rows.push({
        productName: fallbackName,
        color: fallbackColor,
        size: fallbackSize,
        quantity: Math.max(1, Math.round(q)),
      });
    }
  }
  return rows;
}

export function InboundRegistrationDrawer({
  open,
  onOpenChange,
  catalogLoading,
  catalog,
  onAfterSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 拉取 movement-catalog 时为 true；仅在抽屉内展示 Spin，避免按钮 loading 与空表单闪一下 */
  catalogLoading: boolean;
  catalog: ShipmentCatalogProduct[];
  onAfterSubmit?: () => void;
}) {
  const formRef = useRef<ProFormInstance>(undefined);
  const [lastAiUrl, setLastAiUrl] = useState<string>("");

  const drawerColumns = useMemo<ProFormColumnsType<InboundDrawerValues>[]>(
    () => [
      {
        title: "入库照片",
        dataIndex: "photo",
        valueType: "text",
        colProps: { span: 24 },
        formItemProps: {
          rules: [{ required: true, message: "请上传入库照片" }],
          valuePropName: "fileList",
          getValueFromEvent: (e: { fileList?: UploadFile[] }) => e?.fileList ?? [],
        },
        renderFormItem: () => (
          <Upload
            maxCount={1}
            accept="image/*"
            listType="picture"
            name="file"
            action="/api/upload?mode=inbound"
          >
            <Button>选择照片</Button>
          </Upload>
        ),
      },
      {
        title: "登记时间",
        dataIndex: "recordedAt",
        valueType: "dateTime",
        colProps: { span: 24 },
        fieldProps: {
          style: { width: "100%", maxWidth: 360 },
          placeholder: "留空则使用保存时当前时间",
        },
      },
      {
        title: "备注",
        dataIndex: "note",
        valueType: "textarea",
        colProps: { span: 24 },
        fieldProps: { rows: 2, placeholder: "可选" },
      },
      {
        valueType: "formList",
        dataIndex: "lines",
        label: "入库明细",
        colProps: { span: 24 },
        initialValue: [{}],
        fieldProps: {
          min: 1,
          creatorButtonProps: { creatorButtonText: "添加一行" },
          creatorRecord: {},
        },
        columns: [
          {
            valueType: "group",
            title: "衣服信息",
            colProps: { span: 24 },
            columns: [
              {
                title: "",
                dataIndex: "productName",
                valueType: "text",
                colProps: { span: 6 },
                fieldProps: { placeholder: "如：春季短袖T恤" },
              },
              {
                title: "",
                dataIndex: "color",
                valueType: "text",
                colProps: { span: 6 },
                fieldProps: { placeholder: "如：黑色" },
              },
              {
                title: "",
                dataIndex: "size",
                valueType: "text",
                colProps: { span: 6 },
                fieldProps: { placeholder: "如：L" },
              },
              {
                title: "",
                dataIndex: "quantity",
                valueType: "digit",
                colProps: { span: 6 },
                fieldProps: { min: 1, precision: 0, placeholder: "件数" },
              },
            ],
          },
        ],
      },
    ],
    [],
  );

  return (
    <Drawer
      title="登记入库"
      open={open}
      onClose={() => onOpenChange(false)}
      destroyOnHidden
      size={720}
      styles={{ body: { paddingTop: 12 } }}
    >
      {catalogLoading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
          <Spin size="large" />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">正在加载衣服与 SKU 目录…</span>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            上传入库群里的照片并填写本次收到的 SKU 与件数；照片会保存到服务器存档。
          </p>
          <BetaSchemaForm<InboundDrawerValues>
            formRef={formRef}
            layoutType="Form"
            grid
            rowProps={{ gutter: [16, 8] }}
            layout="horizontal"
            labelCol={{ flex: "0 0 112px" }}
            wrapperCol={{ flex: "1 1 auto" }}
            labelAlign="right"
            submitter={{
              searchConfig: { submitText: "保存入库登记", resetText: "取消" },
              submitButtonProps: {},
              resetButtonProps: { onClick: () => onOpenChange(false) },
            }}
            columns={drawerColumns}
            initialValues={{
              lines: [{}],
            }}
            onFinish={async (values) => {
              const uploadItem = values.photo?.[0];
              const uploadResponse = uploadItem?.response as
                | UploadApiSuccess
                | UploadApiFail
                | undefined;
              if (
                uploadResponse &&
                uploadResponse.success &&
                uploadResponse.data.duplicateInbound
              ) {
                const t = new Date(uploadResponse.data.duplicateInbound.recordedAt).toLocaleString(
                  "zh-CN",
                );
                message.error(`该批次已登记（时间：${t}），请勿重复提交`);
                return false;
              }
              const uploadedUrl =
                uploadItem?.url ??
                (uploadResponse && uploadResponse.success ? uploadResponse.data.url : "");
              if (!uploadedUrl) {
                message.error("请先等待图片上传完成");
                return false;
              }
              const fd = inboundDrawerValuesToFormData(values);
              const r = await createInboundInline(fd);
              if (r?.error) {
                message.error(r.error);
                return false;
              }
              message.success("已保存入库登记");
              onAfterSubmit?.();
              onOpenChange(false);
              return true;
            }}
            onValuesChange={(_, allValues) => {
              const uploadItem = (allValues as InboundDrawerValues).photo?.[0];
              const uploadResponse = uploadItem?.response as
                | UploadApiSuccess
                | UploadApiFail
                | undefined;
              if (!uploadResponse || !uploadResponse.success) return;
              if (!uploadResponse.data.ai) return;
              if (uploadResponse.data.url === lastAiUrl) return;
              setLastAiUrl(uploadResponse.data.url);
              const ai = uploadResponse.data.ai;
              const mapped = mapAiLinesToFormLines(ai.lines, catalog);
              const patch: Record<string, unknown> = {};
              if (mapped.length > 0) {
                patch.lines = mapped.map((x) => ({
                  productName: x.productName,
                  color: x.color,
                  size: x.size,
                  quantity: x.quantity,
                }));
              }
              const summaryFromAi = buildLineSummaryNote(
                mapped.map((x) => ({ productName: x.productName, quantity: x.quantity })),
              );
              const aiNote = String(ai.note ?? "").trim();
              const aiBatchNo = String(ai.batchNo ?? "").trim();
              const batchLine = aiBatchNo ? `批次：${aiBatchNo}` : "";
              const noteCore = [batchLine, summaryFromAi].filter((x) => x).join("\n");
              if (noteCore || aiNote) {
                patch.note = aiNote ? (noteCore ? `${noteCore}\n\n${aiNote}` : aiNote) : noteCore;
              }
              if (ai.recordedAt) {
                const d = dayjs(ai.recordedAt);
                if (d.isValid()) patch.recordedAt = d;
              }
              if (Object.keys(patch).length > 0) {
                formRef.current?.setFieldsValue(patch);
              }
            }}
          />
        </>
      )}
    </Drawer>
  );
}

type ShipmentDrawerValues = {
  manufacturerId?: string;
  newManufacturerName?: string;
  photo?: UploadFile[];
  recordedAt?: Dayjs;
  note?: string;
  lines?: { productName?: string; color?: string; size?: string; quantity?: number }[];
};

function shipmentDrawerValuesToFormData(values: ShipmentDrawerValues): FormData {
  const fd = new FormData();
  fd.set("manufacturerId", String(values.manufacturerId ?? "").trim());
  fd.set("newManufacturerName", String(values.newManufacturerName ?? "").trim());
  const uploaded = values.photo?.[0];
  const response = uploaded?.response as UploadApiSuccess | UploadApiFail | undefined;
  const aiOrderNo =
    response && response.success ? String(response.data.ai?.orderNo ?? "").trim() : "";
  const summaryNote = buildLineSummaryNote(values.lines ?? []);
  const orderNoLine = aiOrderNo ? `单号：${aiOrderNo}` : "";
  const noteCore = [orderNoLine, summaryNote].filter((x) => x).join("\n");
  const rawNote = String(values.note ?? "").trim();
  const note = rawNote ? (noteCore ? `${noteCore}\n\n${rawNote}` : rawNote) : noteCore;
  fd.set("note", note);
  const ra = formatRecordedAtForServer(values.recordedAt);
  if (ra) fd.set("recordedAt", ra);

  const lines = (values.lines ?? [])
    .map((r) => {
      const productName = String(r?.productName ?? "").trim();
      const color = String(r?.color ?? "").trim();
      const size = String(r?.size ?? "").trim();
      const q = r?.quantity;
      const quantity = typeof q === "number" ? q : Number.parseInt(String(q ?? ""), 10);
      return { productName, color, size, quantity };
    })
    .filter((r) => r.productName && r.color && r.size && Number.isInteger(r.quantity) && r.quantity > 0);
  fd.set("linesJson", JSON.stringify(lines));

  const photoUrl = uploaded?.url ?? (response && response.success ? response.data.url : "");
  const photoMimeType =
    response && response.success && response.data.mimeType ? response.data.mimeType : "";
  if (photoUrl) {
    fd.set("photoUrl", photoUrl);
  }
  if (photoMimeType) {
    fd.set("photoMimeType", photoMimeType);
  }
  return fd;
}

export function ShipmentRegistrationDrawer({
  open,
  onOpenChange,
  catalogLoading,
  catalog,
  manufacturers,
  onAfterSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogLoading: boolean;
  catalog: ShipmentCatalogProduct[];
  manufacturers: ManufacturerOption[];
  onAfterSubmit?: () => void;
}) {
  const formRef = useRef<ProFormInstance>(undefined);
  const [lastAiUrl, setLastAiUrl] = useState<string>("");

  const mfrOptions = useMemo(
    () => manufacturers.map((m) => ({ label: m.name, value: m.id })),
    [manufacturers],
  );

  const drawerColumns = useMemo<ProFormColumnsType<ShipmentDrawerValues>[]>(
    () => [
      {
        valueType: "group",
        label: "厂家（可选）",
        colProps: { span: 24 },
        columns: [
          {
            title: "已有厂家",
            dataIndex: "manufacturerId",
            valueType: "select",
            colProps: { xs: 24, md: 12 },
            fieldProps: {
              allowClear: true,
              showSearch: true,
              optionFilterProp: "label",
              placeholder: "不选",
              options: mfrOptions,
            },
          },
          {
            title: "新厂家名称",
            dataIndex: "newManufacturerName",
            valueType: "text",
            colProps: { xs: 24, md: 12 },
            fieldProps: { placeholder: "填写则创建并关联" },
          },
        ],
      },
      {
        title: "发货照片",
        dataIndex: "photo",
        valueType: "text",
        colProps: { span: 24 },
        formItemProps: {
          rules: [{ required: true, message: "请上传发货照片" }],
          valuePropName: "fileList",
          getValueFromEvent: (e: { fileList?: UploadFile[] }) => e?.fileList ?? [],
        },
        renderFormItem: () => (
          <Upload
            maxCount={1}
            accept="image/*"
            listType="picture"
            name="file"
            action="/api/upload?mode=shipment"
          >
            <Button>选择照片</Button>
          </Upload>
        ),
      },
      {
        title: "登记时间",
        dataIndex: "recordedAt",
        valueType: "dateTime",
        colProps: { span: 24 },
        fieldProps: {
          style: { width: "100%", maxWidth: 360 },
          placeholder: "留空则使用保存时当前时间",
        },
      },
      {
        title: "备注",
        dataIndex: "note",
        valueType: "textarea",
        colProps: { span: 24 },
        fieldProps: { rows: 2, placeholder: "可选" },
      },
      {
        valueType: "formList",
        dataIndex: "lines",
        label: "发货明细",
        colProps: { span: 24 },
        initialValue: [{}],
        fieldProps: {
          min: 1,
          creatorButtonProps: { creatorButtonText: "添加一行" },
          creatorRecord: {},
        },
        columns: [
          {
            valueType: "group",
            title: "衣服信息",
            colProps: { span: 24 },
            columns: [
              {
                title: "",
                dataIndex: "productName",
                valueType: "text",
                colProps: { span: 6 },
                fieldProps: { placeholder: "如：春季短袖T恤" },
              },
              {
                title: "",
                dataIndex: "color",
                valueType: "text",
                colProps: { span: 6 },
                fieldProps: { placeholder: "如：黑色" },
              },
              {
                title: "",
                dataIndex: "size",
                valueType: "text",
                colProps: { span: 6 },
                fieldProps: { placeholder: "如：L" },
              },
              {
                title: "",
                dataIndex: "quantity",
                valueType: "digit",
                colProps: { span: 6 },
                fieldProps: { min: 1, precision: 0, placeholder: "件数" },
              },
            ],
          },
        ],
      },
    ],
    [mfrOptions],
  );

  return (
    <Drawer
      title="登记厂家发货"
      open={open}
      onClose={() => onOpenChange(false)}
      destroyOnHidden
      size={720}
      styles={{ body: { paddingTop: 12 } }}
    >
      {catalogLoading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
          <Spin size="large" />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">正在加载衣服与 SKU 目录…</span>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            上传群里的发货照片并填写本次发出的 SKU 与件数；照片会保存到服务器存档。
          </p>
          <BetaSchemaForm<ShipmentDrawerValues>
            formRef={formRef}
            layoutType="Form"
            grid
            rowProps={{ gutter: [16, 8] }}
            layout="horizontal"
            labelCol={{ flex: "0 0 112px" }}
            wrapperCol={{ flex: "1 1 auto" }}
            labelAlign="right"
            submitter={{
              searchConfig: { submitText: "保存发货登记", resetText: "取消" },
              submitButtonProps: {},
              resetButtonProps: { onClick: () => onOpenChange(false) },
            }}
            columns={drawerColumns}
            initialValues={{
              lines: [{}],
            }}
            onFinish={async (values) => {
              const uploadItem = values.photo?.[0];
              const uploadResponse = uploadItem?.response as
                | UploadApiSuccess
                | UploadApiFail
                | undefined;
              if (
                uploadResponse &&
                uploadResponse.success &&
                uploadResponse.data.duplicateShipment
              ) {
                const t = new Date(uploadResponse.data.duplicateShipment.recordedAt).toLocaleString(
                  "zh-CN",
                );
                message.error(`该单号已登记（时间：${t}），请勿重复提交`);
                return false;
              }
              const uploadedUrl =
                uploadItem?.url ??
                (uploadResponse && uploadResponse.success ? uploadResponse.data.url : "");
              if (!uploadedUrl) {
                message.error("请先等待图片上传完成");
                return false;
              }
              const fd = shipmentDrawerValuesToFormData(values);
              const r = await createShipmentInline(fd);
              if (r?.error) {
                message.error(r.error);
                return false;
              }
              message.success("已保存发货登记");
              onAfterSubmit?.();
              onOpenChange(false);
              return true;
            }}
            onValuesChange={(_, allValues) => {
              const uploadItem = (allValues as ShipmentDrawerValues).photo?.[0];
              const uploadResponse = uploadItem?.response as
                | UploadApiSuccess
                | UploadApiFail
                | undefined;
              if (!uploadResponse || !uploadResponse.success) return;
              if (!uploadResponse.data.ai) return;
              if (uploadResponse.data.url === lastAiUrl) return;
              setLastAiUrl(uploadResponse.data.url);
              const ai = uploadResponse.data.ai;
              const mapped = mapAiLinesToFormLines(ai.lines, catalog);
              const patch: Record<string, unknown> = {};
              if (mapped.length > 0) {
                patch.lines = mapped.map((x) => ({
                  productName: x.productName,
                  color: x.color,
                  size: x.size,
                  quantity: x.quantity,
                }));
              }
              const summaryFromAi = buildLineSummaryNote(
                mapped.map((x) => ({ productName: x.productName, quantity: x.quantity })),
              );
              const aiNote = String(ai.note ?? "").trim();
              const aiOrderNo = String(ai.orderNo ?? "").trim();
              const orderNoLine = aiOrderNo ? `单号：${aiOrderNo}` : "";
              const noteCore = [orderNoLine, summaryFromAi].filter((x) => x).join("\n");
              if (noteCore || aiNote) {
                patch.note = aiNote ? (noteCore ? `${noteCore}\n\n${aiNote}` : aiNote) : noteCore;
              }
              if (ai.recordedAt) {
                const d = dayjs(ai.recordedAt);
                if (d.isValid()) patch.recordedAt = d;
              }
              if (ai.manufacturerName) {
                const matchedId = bestMatchManufacturerId(ai.manufacturerName, manufacturers);
                if (matchedId) {
                  patch.manufacturerId = matchedId;
                  patch.newManufacturerName = "";
                } else {
                  patch.manufacturerId = "";
                  patch.newManufacturerName = ai.manufacturerName;
                }
              }
              if (Object.keys(patch).length > 0) {
                formRef.current?.setFieldsValue(patch);
              }
            }}
          />
        </>
      )}
    </Drawer>
  );
}

export type MovementCatalogPayload = {
  manufacturers: ManufacturerOption[];
  catalog: ShipmentCatalogProduct[];
};
