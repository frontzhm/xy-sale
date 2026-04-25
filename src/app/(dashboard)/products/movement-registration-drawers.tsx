"use client";

import { BetaSchemaForm } from "@ant-design/pro-components";
import type { ProFormColumnsType } from "@ant-design/pro-components";
import { Button, Drawer, Spin, Upload, message } from "antd";
import type { UploadFile } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo } from "react";

import { createInboundInline } from "../inbound/actions";
import { createShipmentInline } from "../shipments/actions";
import type { ShipmentCatalogProduct } from "../shipments/shipment-form";
import type { ManufacturerOption } from "./product-form";

type InboundDrawerValues = {
  photo?: UploadFile[];
  recordedAt?: Dayjs;
  note?: string;
  lines?: { productId?: string; skuId?: string; quantity?: number }[];
};

type UploadApiSuccess = {
  success: true;
  data: { fileName: string; url: string; mimeType: string | null };
};

type UploadApiFail = { success: false; error?: string };

function formatRecordedAtForServer(v: unknown): string {
  if (v == null || v === "") return "";
  if (dayjs.isDayjs(v)) return v.toISOString();
  return String(v);
}

function inboundDrawerValuesToFormData(values: InboundDrawerValues): FormData {
  const fd = new FormData();
  fd.set("note", String(values.note ?? "").trim());
  const ra = formatRecordedAtForServer(values.recordedAt);
  if (ra) fd.set("recordedAt", ra);

  const lines = (values.lines ?? [])
    .map((r) => {
      const skuId = String(r?.skuId ?? "").trim();
      const q = r?.quantity;
      const quantity = typeof q === "number" ? q : Number.parseInt(String(q ?? ""), 10);
      return { skuId, quantity };
    })
    .filter((r) => r.skuId && Number.isInteger(r.quantity) && r.quantity > 0);
  fd.set("linesJson", JSON.stringify(lines));

  const uploaded = values.photo?.[0];
  const response = uploaded?.response as UploadApiSuccess | UploadApiFail | undefined;
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
  const hasCatalog = useMemo(() => catalog.some((p) => p.skus.length > 0), [catalog]);

  const productOptions = useMemo(
    () =>
      catalog.map((p) => ({
        label: p.label,
        value: p.id,
        disabled: p.skus.length === 0,
      })),
    [catalog],
  );

  const catalogByProductId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);

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
            action="/api/upload"
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
            title: "衣服",
            dataIndex: "productId",
            valueType: "select",
            colProps: { xs: 24, md: 10 },
            fieldProps: {
              options: productOptions,
              placeholder: "请选择",
              showSearch: true,
              optionFilterProp: "label",
            },
          },
          {
            valueType: "dependency",
            name: ["productId"],
            columns: (deps: { productId?: string }) => {
              const p = deps?.productId ? catalogByProductId.get(deps.productId) : undefined;
              const skuOpts = p?.skus.map((s) => ({ label: s.label, value: s.id })) ?? [];
              return [
                {
                  title: "颜色 / 尺码（SKU）",
                  dataIndex: "skuId",
                  valueType: "select",
                  colProps: { xs: 24, md: 10 },
                  fieldProps: {
                    options: skuOpts,
                    placeholder: "请选择",
                    disabled: !deps?.productId,
                  },
                },
              ];
            },
          },
          {
            title: "件数",
            dataIndex: "quantity",
            valueType: "digit",
            colProps: { xs: 24, md: 4 },
            fieldProps: { min: 1, precision: 0, placeholder: "件数" },
          },
        ],
      },
    ],
    [catalogByProductId, productOptions],
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
            layoutType="Form"
            grid
            rowProps={{ gutter: [16, 8] }}
            layout="horizontal"
            labelCol={{ flex: "0 0 112px" }}
            wrapperCol={{ flex: "1 1 auto" }}
            labelAlign="right"
            submitter={{
              searchConfig: { submitText: "保存入库登记", resetText: "取消" },
              submitButtonProps: { disabled: !hasCatalog },
              resetButtonProps: { onClick: () => onOpenChange(false) },
            }}
            columns={drawerColumns}
            initialValues={{
              lines: [{}],
            }}
            onFinish={async (values) => {
              if (!hasCatalog) {
                message.warning("暂无带 SKU 的衣服档案，请先在上方维护档案。");
                return false;
              }
              const uploadItem = values.photo?.[0];
              const uploadResponse = uploadItem?.response as
                | UploadApiSuccess
                | UploadApiFail
                | undefined;
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
  lines?: { productId?: string; skuId?: string; quantity?: number }[];
};

function shipmentDrawerValuesToFormData(values: ShipmentDrawerValues): FormData {
  const fd = new FormData();
  fd.set("manufacturerId", String(values.manufacturerId ?? "").trim());
  fd.set("newManufacturerName", String(values.newManufacturerName ?? "").trim());
  fd.set("note", String(values.note ?? "").trim());
  const ra = formatRecordedAtForServer(values.recordedAt);
  if (ra) fd.set("recordedAt", ra);

  const lines = (values.lines ?? [])
    .map((r) => {
      const skuId = String(r?.skuId ?? "").trim();
      const q = r?.quantity;
      const quantity = typeof q === "number" ? q : Number.parseInt(String(q ?? ""), 10);
      return { skuId, quantity };
    })
    .filter((r) => r.skuId && Number.isInteger(r.quantity) && r.quantity > 0);
  fd.set("linesJson", JSON.stringify(lines));

  const uploaded = values.photo?.[0];
  const response = uploaded?.response as UploadApiSuccess | UploadApiFail | undefined;
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
  const hasCatalog = useMemo(() => catalog.some((p) => p.skus.length > 0), [catalog]);

  const mfrOptions = useMemo(
    () => manufacturers.map((m) => ({ label: m.name, value: m.id })),
    [manufacturers],
  );

  const productOptions = useMemo(
    () =>
      catalog.map((p) => ({
        label: p.label,
        value: p.id,
        disabled: p.skus.length === 0,
      })),
    [catalog],
  );

  const catalogByProductId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);

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
            action="/api/upload"
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
            title: "衣服",
            dataIndex: "productId",
            valueType: "select",
            colProps: { xs: 24, md: 10 },
            fieldProps: {
              options: productOptions,
              placeholder: "请选择",
              showSearch: true,
              optionFilterProp: "label",
            },
          },
          {
            valueType: "dependency",
            name: ["productId"],
            columns: (deps: { productId?: string }) => {
              const p = deps?.productId ? catalogByProductId.get(deps.productId) : undefined;
              const skuOpts = p?.skus.map((s) => ({ label: s.label, value: s.id })) ?? [];
              return [
                {
                  title: "颜色 / 尺码（SKU）",
                  dataIndex: "skuId",
                  valueType: "select",
                  colProps: { xs: 24, md: 10 },
                  fieldProps: {
                    options: skuOpts,
                    placeholder: "请选择",
                    disabled: !deps?.productId,
                  },
                },
              ];
            },
          },
          {
            title: "件数",
            dataIndex: "quantity",
            valueType: "digit",
            colProps: { xs: 24, md: 4 },
            fieldProps: { min: 1, precision: 0, placeholder: "件数" },
          },
        ],
      },
    ],
    [catalogByProductId, mfrOptions, productOptions],
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
            layoutType="Form"
            grid
            rowProps={{ gutter: [16, 8] }}
            layout="horizontal"
            labelCol={{ flex: "0 0 112px" }}
            wrapperCol={{ flex: "1 1 auto" }}
            labelAlign="right"
            submitter={{
              searchConfig: { submitText: "保存发货登记", resetText: "取消" },
              submitButtonProps: { disabled: !hasCatalog },
              resetButtonProps: { onClick: () => onOpenChange(false) },
            }}
            columns={drawerColumns}
            initialValues={{
              lines: [{}],
            }}
            onFinish={async (values) => {
              if (!hasCatalog) {
                message.warning("暂无带 SKU 的衣服档案，请先在上方维护档案。");
                return false;
              }
              const uploadItem = values.photo?.[0];
              const uploadResponse = uploadItem?.response as
                | UploadApiSuccess
                | UploadApiFail
                | undefined;
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
