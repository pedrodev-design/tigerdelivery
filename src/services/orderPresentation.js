import { products } from '../pages/Catalog/data'
import { supabase } from '../lib/supabase'

const demoPhotos = new Map(products.map(product => [product.name.toLocaleLowerCase('pt-BR'), `/images/${product.image}.jpg`]))

export function orderPhoto(context) {
  return context?.item_image_url || demoPhotos.get(context?.item_name?.toLocaleLowerCase('pt-BR')) || null
}

export async function loadOrderPresentations(orders) {
  if (!orders.length) return {}
  const { data, error } = await supabase.rpc('order_display_context', { p_order_ids: orders.map(order => order.id).slice(0, 50) })
  if (error) return {}
  return Object.fromEntries((data || []).map(context => [context.order_id, context]))
}
