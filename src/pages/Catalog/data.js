export const categories = [
  { id: 'all', label: 'Tudo', image: 'burger' },
  { id: 'burgers', label: 'Hambúrgueres', image: 'burger' },
  { id: 'pizza', label: 'Pizzas', image: 'pizza' },
  { id: 'japanese', label: 'Japonesa', image: 'sushi' },
  { id: 'meals', label: 'Refeições', image: 'pasta' },
  { id: 'chicken', label: 'Frango', image: 'chicken' },
  { id: 'healthy', label: 'Saudáveis', image: 'bowl' },
  { id: 'desserts', label: 'Doces', image: 'dessert' },
  { id: 'drinks', label: 'Cafés', image: 'coffee' },
]

// Demonstration catalog. Replace with merchant data when the ordering API is connected.
export const products = [
  { id: 'burger', name: 'Burger da casa', shop: 'Brasa Burger', category: 'burgers', image: 'burger', description: 'Pão macio, hambúrguer bovino grelhado, queijo derretido, alface, tomate e molho da casa.', price: 27.90, original: 34.90, rating: '4,9', time: 25, delivery: 0, tag: 'Mais pedido', color: '#efe4ce' },
  { id: 'pizza', name: 'Pizza margherita', shop: 'Forno & Fatia', category: 'pizza', image: 'pizza', description: 'Massa de fermentação lenta, molho de tomate, muçarela e manjericão fresco. Pizza grande, 8 fatias.', price: 49.90, original: 59.90, rating: '4,8', time: 40, delivery: 4.90, tag: 'R$ 10 de desconto', color: '#f8dfce', startingAt: true },
  { id: 'sushi', name: 'Seleção do sushiman', shop: 'Nori Sushi', category: 'japanese', image: 'sushi', description: 'Uma seleção de 20 peças com sashimis, niguiris e uramakis de salmão. Acompanha shoyu, gengibre e wasabi.', price: 54.90, original: null, rating: '4,9', time: 35, delivery: 0, tag: '', color: '#e4eddf', startingAt: true },
  { id: 'chicken', name: 'Frango crocante', shop: 'Croc Chicken', category: 'chicken', image: 'chicken', description: 'Pedaços de frango empanados, dourados e crocantes. Porção para duas pessoas com molho especial.', price: 32.90, original: 39.90, rating: '4,7', time: 25, delivery: 0, tag: 'Oferta do dia', color: '#f5e5d0' },
  { id: 'bowl', name: 'Bowl da estação', shop: 'Verde Cozinha', category: 'healthy', image: 'bowl', description: 'Uma combinação leve de folhas, legumes frescos e grãos, finalizada com molho de ervas da casa.', price: 28.90, original: null, rating: '4,8', time: 20, delivery: 0, tag: '', color: '#e5edd9' },
  { id: 'pasta', name: 'Pasta ao pesto', shop: 'Casa da Massa', category: 'meals', image: 'pasta', description: 'Massa envolvida em pesto de manjericão, azeite e parmesão. Preparada na hora e finalizada com ervas frescas.', price: 36.90, original: 42.90, rating: '4,9', time: 30, delivery: 3.90, tag: 'Feito na hora', color: '#e4e8d7', startingAt: true },
  { id: 'dessert', name: 'Fatia de felicidade', shop: 'Doce Pedaço', category: 'desserts', image: 'dessert', description: 'Uma generosa fatia de bolo de chocolate, com massa fofinha e cobertura cremosa de chocolate.', price: 18.90, original: null, rating: '4,9', time: 20, delivery: 2.90, tag: '', color: '#f3e2df' },
  { id: 'coffee', name: 'Café para a sua pausa', shop: 'Café do Bairro', category: 'drinks', image: 'coffee', description: 'Café especial, moído e preparado na hora. Uma pausa cheia de aroma para o seu dia.', price: 12.90, original: null, rating: '4,8', time: 15, delivery: 0, tag: '', color: '#eee3d5' },
  { id: 'smash', name: 'Smash duplo com fritas', shop: 'Ponto do Smash', category: 'burgers', image: 'burger', description: 'Dois burgers prensados na chapa, queijo, cebola caramelizada e fritas sequinhas.', price: 31.90, original: 39.90, rating: '4,7', time: 20, delivery: 0, tag: 'Oferta', color: '#efe4ce' },
  { id: 'parmegiana', name: 'Parmegiana executiva', shop: 'Cantina do Bairro', category: 'meals', image: 'pasta', description: 'Filé empanado, molho de tomate, queijo gratinado, arroz e batata frita.', price: 35.90, original: null, rating: '4,8', time: 25, delivery: 0, tag: '', color: '#e4e8d7', startingAt: true },
  { id: 'salmon', name: 'Combinado salmão 24 peças', shop: 'Sato Sushi', category: 'japanese', image: 'sushi', description: 'Sashimis, niguiris e uramakis de salmão preparados no momento do pedido.', price: 62.90, original: 74.90, rating: '4,9', time: 35, delivery: 5.90, tag: 'Combo', color: '#e4eddf' },
  { id: 'fit', name: 'Frango grelhado com legumes', shop: 'Leve Cozinha', category: 'healthy', image: 'bowl', description: 'Frango grelhado, arroz integral, legumes e molho cítrico servido à parte.', price: 29.90, original: null, rating: '4,6', time: 20, delivery: 0, tag: '', color: '#e5edd9' },
  { id: 'brownie', name: 'Brownie com sorvete', shop: 'Doce de Casa', category: 'desserts', image: 'dessert', description: 'Brownie de chocolate aquecido com sorvete de creme e calda artesanal.', price: 21.90, original: 26.90, rating: '4,8', time: 15, delivery: 3.90, tag: 'Sobremesa', color: '#f3e2df' },
  { id: 'capuccino', name: 'Cappuccino e pão de queijo', shop: 'Padoca Central', category: 'drinks', image: 'coffee', description: 'Cappuccino cremoso acompanhado de três pães de queijo assados na hora.', price: 18.50, original: null, rating: '4,7', time: 15, delivery: 0, tag: '', color: '#eee3d5' },
]
export const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
