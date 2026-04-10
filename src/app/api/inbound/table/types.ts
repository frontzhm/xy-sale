export type InboundTableFilterMeta = {
  invalidProductId: boolean;
  product: { id: string; nameInbound: string; nameManufacturer: string } | null;
  skuIdsEmpty: boolean;
};
