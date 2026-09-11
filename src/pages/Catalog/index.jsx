import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight as ArrowRight,
  faBagShopping as Bag,
  faBolt as Lightning,
  faCheck as Check,
  faChevronDown as CaretDown,
  faChevronLeft as CaretLeft,
  faChevronRight as CaretRight,
  faCircleQuestion as Question,
  faHeart as Heart,
  faHouse as House,
  faLocationDot as MapPin,
  faLocationCrosshairs as Locate,
  faMagnifyingGlass as MagnifyingGlass,
  faMinus as Minus,
  faPlus as Plus,
  faReceipt as Receipt,
  faShareNodes as Share,
  faSliders as SlidersHorizontal,
  faStar as Star,
  faTableCellsLarge as SquaresFour,
  faTag as Tag,
  faUser as User,
  faXmark as X,
} from '@fortawesome/free-solid-svg-icons'
import { Dialog, Select, Tooltip } from 'radix-ui'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import useEmblaCarousel from 'embla-carousel-react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { categories, products, money } from './data'
import styles from './Catalog.module.css'
import allCategory from '../../assets/icons/tudo-icon.png'
import burgerCategory from '../../assets/icons/burguer-icon.png'
import coffeeCategory from '../../assets/icons/coffe-icon.png'
import mealCategory from '../../assets/icons/pastel-icon.png'
import pizzaCategory from '../../assets/icons/pizza-icon.png'
import healthyCategory from '../../assets/icons/salada-icon.png'
import chickenCategory from '../../assets/icons/salgados-icon.png'
import japaneseCategory from '../../assets/icons/sushi-icon.png'
import dessertCategory from '../../assets/icons/acai-icon.png'
import ordersIllustration from '../../assets/icons/pedidos-icon.png'
import locationIllustration from '../../assets/icons/loc-icon.png'
import bagIllustration from '../../assets/icons/sacola-icon.png'

const Icon = ({ icon, weight: _weight, ...props }) => <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" {...props} />
const tap = { scale: 0.94 }
const spring = { type: 'spring', stiffness: 420, damping: 30 }
const readSaved = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const categoryImages = { all: allCategory, burgers: burgerCategory, pizza: pizzaCategory, japanese: japaneseCategory, meals: mealCategory, chicken: chickenCategory, healthy: healthyCategory, desserts: dessertCategory, drinks: coffeeCategory }
const defaultPoint = [-23.55052, -46.633308]
const locationMarker = L.icon({ iconUrl: locationIllustration, iconSize: [54, 54], iconAnchor: [27, 51] })

const banners = [
  { eyebrow: 'Brasa Burger', title: <>Burger da casa.<br />Feito na brasa.</>, text: 'A partir de R$ 27,90 · Entrega grátis', action: 'Ver hambúrgueres', image: 'burger', category: 'burgers', className: 'yellow', alt: 'Hambúrguer com queijo, folhas frescas e tomate' },
  { eyebrow: 'Forno & Fatia', title: <>Margherita.<br />Direto do forno.</>, text: 'Pizza grande, 8 fatias · R$ 49,90', action: 'Ver pizzas', image: 'pizza', category: 'pizza', className: 'green', alt: 'Pizza com molho de tomate e manjericão' },
  { eyebrow: 'Doce Pedaço', title: <>Bolo de chocolate.<br />Peça sua fatia.</>, text: 'A partir de R$ 18,90', action: 'Ver sobremesas', image: 'dessert', category: 'desserts', className: 'pink', alt: 'Bolo de chocolate com cobertura' },
]
const sortOptions = [['recommended', 'Recomendados'], ['price', 'Menor preço'], ['time', 'Mais rápidos'], ['rating', 'Melhor avaliação']]
const extrasByCategory = {
  burgers: [{ id: 'cheese', name: 'Queijo extra', price: 4 }, { id: 'bacon', name: 'Bacon crocante', price: 5 }, { id: 'egg', name: 'Ovo', price: 3 }, { id: 'sauce', name: 'Molho da casa', price: 2.5 }],
  pizza: [{ id: 'border', name: 'Borda recheada', price: 8 }, { id: 'cheese', name: 'Muçarela extra', price: 6 }, { id: 'olive', name: 'Azeitonas', price: 3 }, { id: 'sauce', name: 'Molho de alho', price: 2.5 }],
  japanese: [{ id: 'ginger', name: 'Gengibre extra', price: 2 }, { id: 'tare', name: 'Molho tarê', price: 2.5 }, { id: 'cream', name: 'Cream cheese', price: 4 }, { id: 'joy', name: 'Dupla de joy', price: 8 }],
  default: [{ id: 'protein', name: 'Porção extra', price: 6 }, { id: 'cheese', name: 'Queijo extra', price: 4 }, { id: 'sauce', name: 'Molho da casa', price: 2.5 }, { id: 'drink', name: 'Bebida lata', price: 6 }],
}

function HeroCarousel({ onBrowse }) {
  const [viewportRef, embla] = useEmblaCarousel({ loop: true, align: 'start', duration: 28 })
  const [selected, setSelected] = useState(0)
  const updateSelected = useCallback(() => { if (embla) setSelected(embla.selectedScrollSnap()) }, [embla])
  useEffect(() => {
    if (!embla) return
    embla.on('select', updateSelected).on('reInit', updateSelected)
    return () => { embla.off('select', updateSelected).off('reInit', updateSelected) }
  }, [embla, updateSelected])
  return <section className={styles.heroCarousel} aria-label="Destaques do cardápio">
    <div className={styles.heroViewport} ref={viewportRef}><div className={styles.heroTrack}>{banners.map(banner => <div className={styles.heroSlide} key={banner.category}>
      <div className={`${styles.hero} ${styles[banner.className]}`}>
        <div className={styles.heroCopy}><span className={styles.heroEyebrow}>{banner.eyebrow}</span><h2>{banner.title}</h2><p>{banner.text}</p><motion.button whileTap={tap} transition={spring} onClick={() => onBrowse(banner.category)}>{banner.action}<Icon icon={ArrowRight} /></motion.button></div>
        <div className={styles.heroPhoto}><motion.img className="select-none" src={`/images/${banner.image}.jpg`} alt={banner.alt} draggable="false" whileHover={{ scale: 1.025 }} transition={{ duration: .45, ease: [0.22, 1, 0.36, 1] }} /></div>
      </div>
    </div>)}</div></div>
    <div className={styles.heroDots}>{banners.map((banner, index) => <button key={banner.category} className={selected === index ? styles.dotActive : ''} onClick={() => embla?.scrollTo(index)} aria-label={`Mostrar destaque ${index + 1}`} aria-pressed={selected === index} />)}</div>
    <div className={styles.heroArrows}><motion.button whileTap={tap} aria-label="Destaque anterior" onClick={() => embla?.scrollPrev()}><Icon icon={CaretLeft} /></motion.button><motion.button whileTap={tap} aria-label="Próximo destaque" onClick={() => embla?.scrollNext()}><Icon icon={CaretRight} /></motion.button></div>
  </section>
}

function SortControl({ value, onChange }) {
  return <div className={styles.sortControl}><span>Ordenar por</span><Select.Root value={value} onValueChange={onChange}>
    <Select.Trigger className={styles.sortTrigger} aria-label="Ordenar pratos"><Select.Value /><Select.Icon><Icon icon={CaretDown} /></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content className={styles.sortMenu} position="popper" sideOffset={7} align="end"><Select.Viewport>{sortOptions.map(([id, label]) => <Select.Item className={styles.sortItem} value={id} key={id}><Select.ItemText>{label}</Select.ItemText><Select.ItemIndicator><Icon icon={Check} /></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal>
  </Select.Root></div>
}

function CategoryCarousel({ value, onChange }) {
  const [viewportRef] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true })
  return <section className={styles.categories} ref={viewportRef} aria-label="Categorias">
    <div className={styles.categoryTrack}>{categories.map((cat, index) => <motion.button key={cat.id} whileTap={tap} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .025, .15) }} className={value === cat.id ? styles.categoryActive : ''} aria-pressed={value === cat.id} onClick={() => onChange(cat.id)}>
      <span><img src={categoryImages[cat.id]} alt="" draggable="false" /></span><strong>{cat.label}</strong>
    </motion.button>)}</div>
  </section>
}

function ProductRail({ items, openProduct, add }) {
  const [viewportRef] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
    breakpoints: { '(min-width: 601px)': { active: false } },
  })
  return <div className={styles.productViewport} ref={viewportRef}>
    <motion.div layout className={styles.productGrid}>{items.map((item, index) => <ProductCard key={item.id} item={item} index={index} onOpen={() => openProduct(item)} onAdd={() => add(item)} />)}</motion.div>
  </div>
}

function ProductCard({ item, index, onOpen, onAdd }) {
  return <motion.article layout className={styles.card} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} transition={{ duration: .32, delay: Math.min(index * .035, .2), ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -4 }}>
    <div className={styles.cardImage}>
      <button className={styles.photoButton} aria-label={`Ver detalhes de ${item.name}`} onClick={onOpen}><img src={`/images/${item.image}.jpg`} alt={item.name} loading="lazy" /></button>
      {item.original && <span className={styles.tag}>−{Math.round((1 - item.price / item.original) * 100)}%</span>}
      <motion.button className={styles.add} whileTap={{ scale: .84 }} transition={spring} aria-label={`Adicionar ${item.name} à sacola`} onClick={onAdd}><Icon icon={Plus} /></motion.button>
    </div>
    <div className={styles.cardBody}>
      <div className={styles.priceRow}><div>{item.startingAt && <small className={styles.startingAt}>a partir de</small>}<strong>{money(item.price)}</strong>{item.original && <del>{money(item.original)}</del>}</div></div>
      <button className={styles.productTitle} onClick={onOpen}><h3>{item.name}</h3></button>
      <div className={styles.delivery}><span><Icon icon={Lightning} />{item.time}–{item.time + 10} min</span><i /><span className={item.delivery === 0 ? styles.free : ''}>{item.delivery === 0 ? 'Grátis' : money(item.delivery)}</span></div>
    </div>
  </motion.article>
}

function RestaurantCard({ item, index, favorite, onFavorite, onOpen }) {
  const categoryLabel = categories.find(category => category.id === item.category)?.label || 'Restaurante'
  return <motion.article className={styles.restaurantCard} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28, delay: Math.min(index * .035, .18) }}>
    <button className={styles.restaurantPhoto} onClick={onOpen} aria-label={`Ver ${item.name}`}><img src={`/images/${item.image}.jpg`} alt={item.name} loading="lazy" /></button>
    <div className={styles.restaurantInfo}><button onClick={onOpen}><h3>{item.shop}</h3></button><p><Icon icon={Star} />{item.rating} · {categoryLabel}</p><p><Icon className={styles.deliveryBolt} icon={Lightning} />{item.time}–{item.time + 10} min · {(0.7 + index * 0.6).toFixed(1).replace('.', ',')} km · <strong>{item.delivery === 0 ? 'Grátis' : money(item.delivery)}</strong></p>{item.original && <span>Itens com até {Math.round((1 - item.price / item.original) * 100)}% OFF</span>}</div>
    <motion.button whileTap={tap} className={styles.restaurantFavorite} aria-label={`${favorite ? 'Remover' : 'Adicionar'} ${item.shop} ${favorite ? 'dos' : 'aos'} favoritos`} aria-pressed={favorite} onClick={onFavorite}><Icon icon={Heart} /></motion.button>
  </motion.article>
}

function PromoBanner({ tone, eyebrow, title, text, image, onClick }) {
  return <motion.aside className={`${styles.promoBanner} ${styles[tone]}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
    <div><span>{eyebrow}</span><h3>{title}</h3><p>{text}</p><button onClick={onClick}>Ver ofertas <Icon icon={CaretRight} /></button></div><img src={`/images/${image}.jpg`} alt="" loading="lazy" />
  </motion.aside>
}

function CatalogSections({ items, discovery, favorites, toggleFavorite, openProduct, add, browse }) {
  if (!discovery) return <motion.div layout className={styles.restaurantList}>{items.map((item, index) => <RestaurantCard key={item.id} item={item} index={index} favorite={favorites.includes(item.id)} onFavorite={() => toggleFavorite(item.id)} onOpen={() => openProduct(item)} />)}</motion.div>

  const offers = items.filter(item => item.original).slice(0, 5)
  const fast = items.filter(item => item.time <= 25).slice(0, 4)
  const popular = [...items].sort((a, b) => parseFloat(b.rating.replace(',', '.')) - parseFloat(a.rating.replace(',', '.'))).slice(0, 5)
  return <div className={styles.discoveryFeed}>
    <ProductRail items={offers} openProduct={openProduct} add={add} />
    <PromoBanner tone="promoYellow" eyebrow="OFERTA DA SEMANA" title="Seu almoço com R$ 12 de desconto" text="Use o cupom TIGRE12 em restaurantes selecionados." image="pasta" onClick={() => browse('meals')} />
    <section className={styles.feedSection}><header><div><h2><Icon className={styles.headingBolt} icon={Lightning} />Pra já</h2><p>Comida boa chegando em até 35 min.</p></div><button onClick={() => browse()}>Ver mais <Icon icon={CaretRight} /></button></header><div className={styles.restaurantList}>{fast.map((item, index) => <RestaurantCard key={item.id} item={item} index={index} favorite={favorites.includes(item.id)} onFavorite={() => toggleFavorite(item.id)} onOpen={() => openProduct(item)} />)}</div></section>
    <PromoBanner tone="promoBlack" eyebrow="ENTREGA GRÁTIS" title="Peça hoje sem pagar entrega" text="Uma seleção de restaurantes com entrega por nossa conta." image="burger" onClick={() => browse('burgers')} />
    <section className={styles.feedSection}><header><div><h2>Mais pedidos perto de você</h2><p>Os favoritos da sua região.</p></div></header><div className={styles.restaurantList}>{popular.map((item, index) => <RestaurantCard key={item.id} item={item} index={index} favorite={favorites.includes(item.id)} onFavorite={() => toggleFavorite(item.id)} onOpen={() => openProduct(item)} />)}</div></section>
  </div>
}

function OrdersEmpty({ onBrowse }) {
  return <section className={styles.ordersEmpty}>
    <motion.img className={styles.ordersIllustration} src={ordersIllustration} alt="" initial={{ opacity: 0, y: 12, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: .4, ease: [0.22, 1, 0.36, 1] }} />
    <h2>Acompanhe seus pedidos por aqui</h2>
    <p>Entre na sua conta para ver pedidos em andamento, entregas e compras anteriores.</p>
    <div className={styles.ordersActions}><a href="#entrar">Entrar na minha conta <Icon icon={ArrowRight} /></a><button onClick={onBrowse}>Explorar restaurantes</button></div>
  </section>
}

function LocationMarker({ point, onChange }) {
  const map = useMapEvents({ click: event => onChange([event.latlng.lat, event.latlng.lng]) })
  useEffect(() => { map.panTo(point, { animate: true, duration: .35 }) }, [map, point])
  return <Marker position={point} icon={locationMarker} draggable eventHandlers={{ dragend: event => { const next = event.target.getLatLng(); onChange([next.lat, next.lng]) } }} />
}

function AddressPage({ address, onBack, onSave }) {
  const [editing, setEditing] = useState(Boolean(address))
  const [point, setPoint] = useState(address?.point || defaultPoint)
  const [locationError, setLocationError] = useState('')

  const locate = () => {
    if (!navigator.geolocation) { setLocationError('Localização indisponível neste navegador.'); return }
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      position => setPoint([position.coords.latitude, position.coords.longitude]),
      () => setLocationError('Não foi possível acessar sua localização. Você pode escolher o ponto no mapa.'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  return <motion.section className={styles.addressPage} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}>
    <header className={styles.addressPageHeader}><motion.button whileTap={tap} onClick={onBack} aria-label="Voltar ao catálogo"><Icon icon={CaretLeft} /></motion.button><div><h1>{editing ? 'Onde você quer receber?' : 'Endereços'}</h1><p>{editing ? 'Marque o ponto exato da entrega' : 'Gerencie seus locais de entrega'}</p></div></header>
    {!editing ? <div className={styles.locationEmpty}><img src={locationIllustration} alt="" /><h2>Você ainda não tem um endereço</h2><p>Adicione um local para encontrar restaurantes próximos e receber seus pedidos.</p><motion.button whileTap={tap} onClick={() => setEditing(true)}>Adicionar endereço <Icon icon={ArrowRight} /></motion.button></div> : <div className={styles.addressEditor}>
      <div className={styles.mapPanel}>
        <MapContainer className={styles.map} center={point} zoom={15} scrollWheelZoom zoomControl attributionControl>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationMarker point={point} onChange={setPoint} />
        </MapContainer>
        <motion.button whileTap={tap} className={styles.locateButton} type="button" onClick={locate}><Icon icon={Locate} />Usar minha localização</motion.button>
        <div className={styles.mapHint}><img src={locationIllustration} alt="" /><span><strong>Posicione o pin</strong><small>Toque no mapa ou arraste até o local exato.</small></span></div>
      </div>
      <form className={styles.locationForm} onSubmit={event => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const street = form.get('street').trim(), number = form.get('number').trim(), neighborhood = form.get('neighborhood').trim(), city = form.get('city').trim()
        onSave({ label: `${street}, ${number} · ${neighborhood || city}`, street, number, complement: form.get('complement').trim(), neighborhood, city, point })
      }}>
        <div className={styles.locationFormHeading}><span>Confirme os detalhes</span><h2>Endereço de entrega</h2><p>O pin ajuda o entregador a encontrar a entrada certa.</p></div>
        <label className={styles.streetField}>Rua ou avenida<input name="street" defaultValue={address?.street || ''} placeholder="Ex.: Rua das Flores" autoComplete="street-address" required /></label>
        <div className={styles.locationFormRow}><label>Número<input name="number" defaultValue={address?.number || ''} inputMode="numeric" placeholder="123" required /></label><label>Complemento <small>opcional</small><input name="complement" defaultValue={address?.complement || ''} placeholder="Apto, bloco..." /></label></div>
        <div className={styles.locationFormRow}><label>Bairro<input name="neighborhood" defaultValue={address?.neighborhood || ''} placeholder="Seu bairro" /></label><label>Cidade<input name="city" defaultValue={address?.city || ''} placeholder="Sua cidade" required /></label></div>
        {locationError && <p className={styles.locationError}>{locationError}</p>}
        <button className={styles.saveAddress}>Salvar endereço <Icon icon={ArrowRight} /></button>
      </form>
    </div>}
  </motion.section>
}

function ProductPage({ product, favorite, onFavorite, onBack, onAdd }) {
  const extras = extrasByCategory[product.category] || extrasByCategory.default
  const [quantity, setQuantity] = useState(1)
  const [selectedExtras, setSelectedExtras] = useState([])
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + (extras.find(extra => extra.id === id)?.price || 0), 0)
  const total = (product.price + extrasTotal) * quantity
  const discount = product.original ? Math.round((1 - product.price / product.original) * 100) : 0
  const toggleExtra = id => setSelectedExtras(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const share = async () => {
    const data = { title: product.name, text: `${product.name} no ${product.shop}`, url: window.location.href }
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(window.location.href) } } catch { /* compartilhamento cancelado */ }
  }

  return <motion.section className={styles.productPage} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}>
    <div className={styles.productHero}><img src={`/images/${product.image}.jpg`} alt={product.name} /><div className={styles.productTopActions}><motion.button whileTap={tap} onClick={onBack} aria-label="Fechar detalhes"><Icon icon={X} /></motion.button><motion.button whileTap={tap} onClick={share} aria-label="Compartilhar produto"><Icon icon={Share} /></motion.button></div></div>
    <div className={styles.productPageBody}>
      <div className={styles.productIdentity}><div><span>{product.shop}</span><h1>{product.name}</h1></div><motion.button whileTap={tap} aria-label={`${favorite ? 'Remover dos' : 'Adicionar aos'} favoritos`} aria-pressed={favorite} onClick={onFavorite}><Icon icon={Heart} /></motion.button></div>
      <div className={styles.productPricing}>{product.startingAt && <small>a partir de</small>}<div><strong>{money(product.price)}</strong>{product.original && <><del>{money(product.original)}</del><span>−{discount}%</span></>}</div></div>
      <p className={styles.productDescription}>{product.description}</p>
      <div className={styles.productMeta}><span><Icon icon={Lightning} />{product.time}–{product.time + 10} min</span><i /><strong>{product.delivery === 0 ? 'Entrega grátis' : `Entrega ${money(product.delivery)}`}</strong></div>
      <section className={styles.extrasSection}><header><h2>Complete seu pedido</h2><p>Escolha até {extras.length}</p></header><div>{extras.map((extra, index) => { const selected = selectedExtras.includes(extra.id); return <button key={extra.id} className={selected ? styles.extraSelected : ''} aria-pressed={selected} onClick={() => toggleExtra(extra.id)}><img src={`/images/${product.image}.jpg`} alt="" /><span><strong>{extra.name}</strong>{index % 2 === 0 && <small>Mais pedido</small>}</span><b>+{money(extra.price)}</b><i><Icon icon={selected ? Check : Plus} /></i></button> })}</div></section>
      <div className={styles.productCheckout}><div className={styles.productQuantity}><button aria-label="Diminuir quantidade" disabled={quantity === 1} onClick={() => setQuantity(value => Math.max(1, value - 1))}><Icon icon={Minus} /></button><span>{quantity}</span><button aria-label="Aumentar quantidade" disabled={quantity === 10} onClick={() => setQuantity(value => Math.min(10, value + 1))}><Icon icon={Plus} /></button></div><motion.button whileTap={tap} className={styles.productAddButton} onClick={() => onAdd(product, quantity, selectedExtras.map(id => extras.find(extra => extra.id === id)))}><span>Adicionar</span><strong>{money(total)}</strong></motion.button></div>
    </div>
  </motion.section>
}

function CartContent({ count, cart, cartExtras, subtotal, changeQuantity, browse }) {
  const items = products.filter(item => cart[item.id])
  const deliveryTotal = items.reduce((sum, item) => sum + item.delivery, 0)
  const total = subtotal + deliveryTotal
  if (!count) return <div className={styles.cartEmpty}><motion.img className={styles.cartIllustration} src={bagIllustration} alt="" initial={{ opacity: 0, y: 12, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: .4, ease: [0.22, 1, 0.36, 1] }} /><h2>Sua sacola está vazia</h2><p>Escolha algo gostoso para começar seu pedido.</p><button onClick={() => browse()}>Explorar restaurantes <Icon icon={ArrowRight} /></button></div>

  const storeName = items.length === 1 ? items[0].shop : `${new Set(items.map(item => item.shop)).size} restaurantes`
  return <>
    <div className={styles.cartStore}><img src="/images/burger.jpg" alt="" /><div><small>Pedido em</small><strong>{storeName}</strong><span>{items.length === 1 ? `${items[0].time}–${items[0].time + 10} min` : 'Entregas separadas por restaurante'}</span></div></div>
    <div className={styles.cartItems}>{items.map(item => {
      const extras = Array.isArray(cartExtras[item.id]) ? cartExtras[item.id] : []
      const unitPrice = item.price + extras.reduce((sum, extra) => sum + Number(extra.price || 0), 0)
      return <motion.article layout className={styles.cartItem} key={item.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}>
        <img src={`/images/${item.image}.jpg`} alt="" />
        <div className={styles.cartItemInfo}><small>{item.shop}</small><h3>{item.name}</h3>{extras.length > 0 && <p className={styles.cartItemExtras}>{extras.map(extra => extra.name).join(' · ')}</p>}<strong>{money(unitPrice * cart[item.id])}</strong><div className={styles.cartItemFooter}><div className={styles.stepper}><motion.button whileTap={tap} aria-label={`Diminuir ${item.name}`} onClick={() => changeQuantity(item.id, -1)}><Icon icon={Minus} /></motion.button><AnimatePresence mode="popLayout" initial={false}><motion.span key={cart[item.id]} initial={{ scale: .65, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.25, opacity: 0 }}>{cart[item.id]}</motion.span></AnimatePresence><motion.button whileTap={tap} aria-label={`Aumentar ${item.name}`} disabled={cart[item.id] >= 99} onClick={() => changeQuantity(item.id, 1)}><Icon icon={Plus} /></motion.button></div><button className={styles.cartRemove} onClick={() => changeQuantity(item.id, -cart[item.id])}>Remover</button></div></div>
      </motion.article>
    })}</div>
    <button className={styles.addMore} onClick={() => browse()}><Icon icon={Plus} />Adicionar mais itens</button>
    <section className={styles.checkoutSummary} aria-label="Resumo da sacola"><div><span>Produtos</span><strong>{money(subtotal)}</strong></div><div><span>Entrega</span><strong className={deliveryTotal === 0 ? styles.checkoutFree : ''}>{deliveryTotal === 0 ? 'Grátis' : money(deliveryTotal)}</strong></div><div className={styles.checkoutTotal}><span>Total</span><strong>{money(total)}</strong></div></section>
    <p className={styles.cartEta}><Icon icon={Lightning} />O prazo de entrega aparece depois que você informar o endereço.</p>
    <a className={styles.checkoutButton} href="#entrar"><span>Entrar para continuar</span><strong>{money(total)}</strong></a>
  </>
}

function CartPage({ count, cart, cartExtras, subtotal, changeQuantity, browse, onBack }) {
  return <motion.section className={styles.cartPage} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}>
    <header className={styles.cartPageHeader}><motion.button whileTap={tap} onClick={onBack} aria-label="Voltar ao catálogo"><Icon icon={CaretLeft} /></motion.button><div><h1>Sua sacola</h1><p>{count ? `${count} ${count === 1 ? 'item selecionado' : 'itens selecionados'}` : 'Pronta para o seu próximo pedido'}</p></div></header>
    <div className={styles.cartPageBody}><CartContent count={count} cart={cart} cartExtras={cartExtras} subtotal={subtotal} changeQuantity={changeQuantity} browse={browse} /></div>
  </motion.section>
}

function CatalogDialog({ modal, setModal }) {
  return <Dialog.Root open={Boolean(modal)} onOpenChange={open => { if (!open) setModal(null) }}><AnimatePresence>{modal && <Dialog.Portal forceMount>
    <Dialog.Overlay asChild forceMount><motion.div className={styles.dialogOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /></Dialog.Overlay>
    <Dialog.Content asChild forceMount><motion.section className={styles.dialog} initial={{ opacity: 0, y: 22, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .985 }} transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}><div className={styles.dialogContent}>
      <Dialog.Close asChild><motion.button whileTap={tap} className={styles.close} aria-label="Fechar"><Icon icon={X} /></motion.button></Dialog.Close>
      {modal.type === 'help' && <><span className={styles.modalIcon}><Icon icon={Question} /></span><Dialog.Title asChild><h2>Como podemos ajudar?</h2></Dialog.Title><Dialog.Description className={styles.modalSubtitle}>Conheça esta prévia do TigreFood.</Dialog.Description><details open><summary>Como explorar o catálogo?</summary><p>Busque um prato ou restaurante, escolha uma categoria e combine os filtros. Toque em um prato para ver os detalhes.</p></details><details><summary>Posso fazer um pedido?</summary><p>Ainda não. As lojas, os valores e os prazos são demonstrativos.</p></details><details><summary>Onde ficam meus favoritos?</summary><p>Os pratos marcados com coração ficam na seção Favoritos e são salvos neste navegador.</p></details></>}
      {modal.type === 'profile' && <><div className={styles.profileHero}><span className={styles.profileAvatar}><Icon icon={User} /></span><div><Dialog.Title asChild><h2>Olá, visitante</h2></Dialog.Title><Dialog.Description>Entre para salvar endereços, favoritos e acompanhar pedidos.</Dialog.Description></div></div><div className={styles.profileAuth}><a className={styles.profilePrimary} href="#entrar">Entrar</a><a className={styles.profileSecondary} href="#criar-conta">Criar conta</a></div><div className={styles.profileList}><button onClick={() => modal.navigate('orders')}><span><Icon icon={Receipt} />Meus pedidos</span><Icon icon={CaretRight} /></button><button onClick={() => modal.navigate('favorites')}><span><Icon icon={Heart} />Favoritos</span><Icon icon={CaretRight} /></button><button onClick={modal.openAddress}><span><Icon icon={MapPin} />Endereço de entrega</span><Icon icon={CaretRight} /></button><button onClick={() => setModal({ type: 'help' })}><span><Icon icon={Question} />Ajuda e informações</span><Icon icon={CaretRight} /></button></div><p className={styles.profileNote}>TigreFood</p></>}
    </div></motion.section></Dialog.Content>
  </Dialog.Portal>}</AnimatePresence></Dialog.Root>
}

export function CatalogPage() {
  const reducedMotion = useReducedMotion()
  const [page, setPage] = useState('home'), [category, setCategory] = useState('all'), [query, setQuery] = useState(''), [sort, setSort] = useState('recommended')
  const [free, setFree] = useState(false), [fast, setFast] = useState(false), [filters, setFilters] = useState(false)
  const [favorites, setFavorites] = useState(() => { const saved = readSaved('tigre-favorites', []); return Array.isArray(saved) ? saved.filter(id => products.some(p => p.id === id)) : [] })
  const [cart, setCart] = useState(() => { const saved = readSaved('tigre-cart', {}); return Object.fromEntries(products.map(p => [p.id, Math.max(0, Math.min(99, Number.isInteger(saved?.[p.id]) ? saved[p.id] : 0))])) })
  const [cartExtras, setCartExtras] = useState(() => { const saved = readSaved('tigre-cart-extras', {}); return saved && typeof saved === 'object' ? saved : {} })
  const [selectedProduct, setSelectedProduct] = useState(products[0])
  const [address, setAddress] = useState(() => { const saved = readSaved('tigre-address', null); return typeof saved === 'string' ? { label: saved } : saved })
  const [modal, setModal] = useState(null), [toast, setToast] = useState('')
  const results = useRef(null), searchInput = useRef(null)
  const count = Object.values(cart).reduce((sum, value) => sum + value, 0)
  const subtotal = products.reduce((sum, item) => {
    const extras = Array.isArray(cartExtras[item.id]) ? cartExtras[item.id] : []
    const unitPrice = item.price + extras.reduce((extraSum, extra) => extraSum + Number(extra.price || 0), 0)
    return sum + (cart[item.id] || 0) * unitPrice
  }, 0)

  useEffect(() => { document.title = 'TigreFood — O que vai ser hoje?' }, [])
  useEffect(() => { localStorage.setItem('tigre-favorites', JSON.stringify(favorites)) }, [favorites])
  useEffect(() => { localStorage.setItem('tigre-cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => { localStorage.setItem('tigre-cart-extras', JSON.stringify(cartExtras)) }, [cartExtras])
  useEffect(() => { localStorage.setItem('tigre-address', JSON.stringify(address)) }, [address])
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 2400); return () => clearTimeout(timeout) }, [toast])
  useEffect(() => { const onKey = event => { if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !modal) { event.preventDefault(); searchInput.current?.focus() } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [modal])

  const visible = useMemo(() => {
    const search = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    const filtered = products.filter(p => (category === 'all' || p.category === category) && (page !== 'favorites' || favorites.includes(p.id)) && (page !== 'offers' || p.original) && (!free || p.delivery === 0) && (!fast || p.time + 10 <= 30) && `${p.name} ${p.shop} ${p.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(search))
    if (sort === 'price') filtered.sort((a, b) => a.price - b.price); if (sort === 'time') filtered.sort((a, b) => a.time - b.time); if (sort === 'rating') filtered.sort((a, b) => parseFloat(b.rating.replace(',', '.')) - parseFloat(a.rating.replace(',', '.')))
    return filtered
  }, [category, query, page, favorites, free, fast, sort])

  function navigate(next) { setPage(next); setCategory('all'); setQuery(''); setFree(false); setFast(false); setFilters(false); setModal(null); window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }) }
  function add(item, amount = 1, extras = []) { setCart(previous => ({ ...previous, [item.id]: Math.min(99, (previous[item.id] || 0) + amount) })); setCartExtras(previous => ({ ...previous, [item.id]: extras.filter(Boolean) })); setToast(`${item.name} adicionado à sacola`) }
  function changeQuantity(id, amount) { setCart(previous => ({ ...previous, [id]: Math.max(0, Math.min(99, (previous[id] || 0) + amount)) })) }
  function toggleFavorite(id) { setFavorites(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]) }
  function browse(next = 'all') { setPage('home'); setCategory(next); setQuery(''); setFree(false); setFast(false); requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })) }
  function openProduct(item) { setSelectedProduct(item); setPage('product'); setModal(null); window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }) }
  function openAddress() { navigate('address') }

  const nav = [{ id: 'home', name: 'Explorar', icon: House }, { id: 'offers', name: 'Ofertas', icon: Tag }, { id: 'favorites', name: 'Favoritos', icon: Heart }, { id: 'orders', name: 'Meus pedidos', icon: Receipt }]
  const heading = page === 'favorites' ? 'Favoritos' : page === 'offers' ? 'Ofertas' : page === 'orders' ? 'Seus pedidos' : page === 'cart' ? 'Sua sacola' : page === 'product' ? selectedProduct.name : page === 'address' ? 'Endereços' : 'Explore o cardápio'
  const sectionTitle = query ? `Resultados para “${query}”` : page === 'favorites' ? 'Pratos salvos' : page === 'offers' ? 'Pratos em oferta' : category !== 'all' ? categories.find(cat => cat.id === category).label : 'Ofertas para você'
  const discovery = page === 'home' && category === 'all' && !query.trim() && !free && !fast && sort === 'recommended'

  const openProfile = () => setModal({ type: 'profile', navigate, openAddress })

  return <MotionConfig reducedMotion="user"><Tooltip.Provider delayDuration={500} skipDelayDuration={200}><div className={`${styles.layout} relative isolate`}>
    <aside className={styles.sidebar}><a href="#catalogo" className={styles.brand} onClick={() => navigate('home')} aria-label="TigreFood, início"><img src="/tiger.svg" alt="" /><span>Tigre<span>Food</span></span></a><nav aria-label="Menu principal">{nav.map(item => <Tooltip.Root key={item.id}><Tooltip.Trigger asChild><motion.button whileTap={tap} className={page === item.id ? styles.navActive : ''} onClick={() => navigate(item.id)} aria-current={page === item.id ? 'page' : undefined}><Icon icon={item.icon} weight={page === item.id ? 'fill' : 'regular'} /><span>{item.name}</span>{item.id === 'favorites' && favorites.length > 0 && <small>{favorites.length}</small>}</motion.button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className={styles.tooltip} side="right" sideOffset={10}>{item.name}<Tooltip.Arrow className={styles.tooltipArrow} /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>)}</nav><div className={styles.sidebarBottom}><button className={styles.help} onClick={() => setModal({ type: 'help' })}><Icon icon={Question} />Precisa de ajuda?</button><span className={styles.sidebarCopyright}>TigreFood</span></div></aside>

    <div className={styles.workspace}><header className={styles.topbar}><motion.button whileTap={tap} className={`${styles.iconButton} ${styles.menuButton}`} onClick={openProfile} aria-label="Abrir perfil" aria-expanded={modal?.type === 'profile'}><Icon icon={User} /></motion.button><motion.button whileTap={tap} className={styles.address} onClick={openAddress}><span className={styles.pin}><img src={locationIllustration} alt="" /></span><span><small>ENTREGAR EM</small><strong>{address?.label || 'Informe seu endereço'}</strong></span><Icon icon={CaretDown} /></motion.button><label className={styles.search}><Icon icon={MagnifyingGlass} /><input ref={searchInput} aria-label="Buscar pratos ou restaurantes" placeholder="Busque um prato ou restaurante" value={query} onChange={event => { setQuery(event.target.value); if (page === 'orders') setPage('home') }} />{query && <motion.button whileTap={tap} onClick={() => setQuery('')} aria-label="Limpar busca"><Icon icon={X} /></motion.button>}<kbd>/</kbd></label><a className={styles.account} href="#entrar"><Icon icon={User} /><span>Entrar</span></a><motion.button whileTap={tap} className={styles.mobileFilter} aria-label="Filtrar cardápio" aria-expanded={filters} onClick={() => { if (page === 'orders') setPage('menu'); setFilters(!filters); requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })) }}><Icon icon={SlidersHorizontal} />{(free || fast) && <i />}</motion.button><motion.button whileTap={{ scale: .92 }} className={styles.bag} onClick={() => navigate('cart')} aria-label={`Abrir sacola, ${count} itens`}><Icon icon={Bag} weight={count ? 'fill' : 'bold'} /><span>Sacola</span><AnimatePresence mode="popLayout" initial={false}><motion.b key={count} initial={{ scale: .45, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 1.3, opacity: 0 }} transition={spring}>{count}</motion.b></AnimatePresence></motion.button></header>
      <main className={styles.main}><AnimatePresence mode="wait" initial={false}><motion.div key={page} className={`${styles.pageContent} min-w-0`} initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -6 }} transition={{ duration: .24, ease: [0.22, 1, 0.36, 1] }}><div className={`${styles.greeting} ${page === 'home' && !query ? styles.homeGreeting : ''} ${['cart', 'product', 'address'].includes(page) ? styles.cartGreeting : ''}`}><h1>{heading}</h1></div>{page === 'home' && !query && <HeroCarousel onBrowse={browse} />}{page === 'address' ? <AddressPage address={address} onBack={() => navigate('home')} onSave={value => { setAddress(value); setToast('Endereço salvo'); navigate('home') }} /> : page === 'product' ? <ProductPage key={selectedProduct.id} product={selectedProduct} favorite={favorites.includes(selectedProduct.id)} onFavorite={() => toggleFavorite(selectedProduct.id)} onBack={() => navigate('home')} onAdd={(item, amount, extras) => { add(item, amount, extras); navigate('cart') }} /> : page === 'cart' ? <CartPage count={count} cart={cart} cartExtras={cartExtras} subtotal={subtotal} changeQuantity={changeQuantity} browse={browse} onBack={() => navigate('home')} /> : page !== 'orders' ? <><CategoryCarousel value={category} onChange={setCategory} /><section ref={results} className={styles.results} aria-label="Cardápio"><div className={styles.sectionHeading}><div><h2>{sectionTitle}</h2><p>{visible.length} {visible.length === 1 ? 'opção' : 'opções'}</p></div><motion.button whileTap={tap} className={`${styles.filterButton} ${filters ? styles.filterActive : ''}`} onClick={() => setFilters(!filters)} aria-expanded={filters}><Icon icon={SlidersHorizontal} />Filtros{(free || fast) && <b>{Number(free) + Number(fast)}</b>}</motion.button></div><div className={`${styles.filterRow} ${filters ? styles.filtersExpanded : ''}`}><motion.button whileTap={tap} className={free ? styles.chipActive : ''} aria-pressed={free} onClick={() => setFree(!free)}>Entrega grátis</motion.button><motion.button whileTap={tap} className={fast ? styles.chipActive : ''} aria-pressed={fast} onClick={() => setFast(!fast)}><Icon className={styles.filterBolt} icon={Lightning} />Até 30 min</motion.button><SortControl value={sort} onChange={setSort} /></div><AnimatePresence>{filters && <motion.div className={styles.filterPanel} initial={{ opacity: 0, height: 0, y: -6 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: -6 }}><p>Combine os filtros para encontrar seu pedido.</p><label><input type="checkbox" checked={free} onChange={event => setFree(event.target.checked)} />Somente entrega grátis</label><label><input type="checkbox" checked={fast} onChange={event => setFast(event.target.checked)} />Preparo e entrega em até 30 min</label><button onClick={() => { setFree(false); setFast(false); setCategory('all'); setSort('recommended') }}>Limpar filtros</button></motion.div>}</AnimatePresence><AnimatePresence mode="popLayout">{visible.length ? <CatalogSections items={visible} discovery={discovery} favorites={favorites} toggleFavorite={toggleFavorite} openProduct={openProduct} add={add} browse={browse} /> : <motion.div className={styles.empty} initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }}><Icon icon={page === 'favorites' ? Heart : MagnifyingGlass} /><h3>{page === 'favorites' && !favorites.length ? 'Nenhum favorito salvo.' : 'Não encontramos essa combinação.'}</h3><p>{page === 'favorites' && !favorites.length ? 'Toque no coração de um prato para encontrá-lo aqui depois.' : 'Experimente outro nome ou remova alguns filtros.'}</p><button onClick={() => navigate('home')}>Explorar o cardápio<Icon icon={ArrowRight} /></button></motion.div>}</AnimatePresence></section></> : <OrdersEmpty onBrowse={() => navigate('home')} />}{!['cart', 'product', 'address'].includes(page) && <footer className={styles.footer}><strong>TigreFood</strong><p>Fotos ilustrativas · Lojas, preços e prazos de demonstração.</p><button onClick={() => setModal({ type: 'help' })}>Ajuda e informações<Icon icon={ArrowRight} /></button></footer>}</motion.div></AnimatePresence></main>
    </div>

    <CatalogDialog modal={modal} setModal={setModal} />
    <nav className={styles.bottomNav} aria-label="Navegação do celular"><motion.button whileTap={tap} className={page === 'home' ? styles.bottomActive : ''} aria-current={page === 'home' ? 'page' : undefined} onClick={() => navigate('home')}><Icon icon={House} weight={page === 'home' ? 'fill' : 'regular'} /><span>Início</span></motion.button><motion.button whileTap={tap} className={page === 'menu' ? styles.bottomActive : ''} aria-current={page === 'menu' ? 'page' : undefined} onClick={() => navigate('menu')}><Icon icon={SquaresFour} weight={page === 'menu' ? 'fill' : 'regular'} /><span>Cardápio</span></motion.button><motion.button whileTap={tap} className={`${styles.ordersTab} ${page === 'orders' ? styles.bottomActive : ''}`} aria-current={page === 'orders' ? 'page' : undefined} onClick={() => navigate('orders')}><motion.span className={styles.ordersIcon} animate={page === 'orders' ? { y: -3 } : { y: 0 }} transition={spring}><Icon icon={Receipt} weight={page === 'orders' ? 'fill' : 'bold'} /></motion.span><span>Pedidos</span></motion.button><motion.button whileTap={tap} className={page === 'offers' ? styles.bottomActive : ''} aria-current={page === 'offers' ? 'page' : undefined} onClick={() => navigate('offers')}><Icon icon={Tag} weight={page === 'offers' ? 'fill' : 'regular'} /><span>Ofertas</span></motion.button><motion.button whileTap={tap} className={modal?.type === 'profile' ? styles.bottomActive : ''} onClick={openProfile}><Icon icon={User} /><span>Perfil</span></motion.button></nav>
    <AnimatePresence>{toast && <motion.div className={styles.toast} role="status" initial={{ opacity: 0, y: 16, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 10, x: '-50%' }}><span><Icon icon={Bag} weight="fill" />{toast}</span></motion.div>}</AnimatePresence>
  </div></Tooltip.Provider></MotionConfig>
}




