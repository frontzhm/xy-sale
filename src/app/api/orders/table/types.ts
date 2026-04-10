export type OrderTableFilterMeta = {
  invalidProductId: boolean;
  product: { id: string; nameInbound: string; nameManufacturer: string } | null;
  skuIdsEmpty: boolean;
};
