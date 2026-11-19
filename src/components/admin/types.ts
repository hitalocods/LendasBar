export type AdminView = "dashboard" | "pedidos" | "cardapio" | "categorias" | "qrcodes" | "equipe" | "musica";
export type Product = {
  id: string;
  name: string;
  desc: string;
  category: string;
  price: number;
  imageUrl?: string;
  isFeatured?: boolean;
  isPromo?: boolean;
  promoPrice?: number | null;
};
export type TableRow = {
  id: string;
  number: number;
  qrToken: string;
  status: string;
  sessionId: string | null;
  waiter: { id: string; name: string } | null;
  guests: string[];
  total: number;
};
export type Waiter = {
  id: string;
  name: string;
  tables: string;
};
