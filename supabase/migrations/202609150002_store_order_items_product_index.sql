create index if not exists store_order_items_product_idx
  on public.store_order_items (product_id)
  where product_id is not null;
