export type ShipmentTableFilterMeta = {
  invalidProductId: boolean;
  product: { id: string; nameInbound: string; nameManufacturer: string } | null;
  skuIdsEmpty: boolean;
};
