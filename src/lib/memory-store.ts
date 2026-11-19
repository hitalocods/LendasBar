import { categories as defaultCategories, menuItems as defaultMenuItems } from "@/components/lendas/data";
import { hashPassword } from "@/lib/auth";

export type MemoryTable = {
  id: string;
  number: number;
  qrToken: string;
  status: "AVAILABLE" | "OCCUPIED" | "WAITING_BILL";
  currentSessionId: string | null;
  assignedWaiter: { id: string; name: string } | null;
  guests: string[];
  orders: MemoryOrder[];
  openedAt?: string;
  total: number; // em centavos
};

export type MemoryOrderItem = {
  productName: string;
  quantity: number;
  unitCents: number;
  notes?: string;
};

export type MemoryOrder = {
  id: string;
  tableNumber: number;
  tableToken: string;
  customerName: string;
  items: MemoryOrderItem[];
  totalCents: number;
  status: "PENDING" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
  createdAt: Date;
};

export type MemoryWaiterCall = {
  id: string;
  tableNumber: number;
  tableToken: string;
  customerName: string;
  type: "WAITER" | "BILL";
  status: "OPEN" | "RESOLVED";
  createdAt: Date;
};

export type MemoryMusicRequest = {
  id: string;
  tableToken: string;
  customerName: string;
  title: string;
  artist?: string;
  notes?: string;
  played: boolean;
  createdAt: Date;
};

export type MemoryWaiter = {
  id: string;
  name: string;
  email: string | null;
  role: "WAITER" | "MANAGER";
  passwordHash: string;
};

export type MemoryProduct = {
  id: string;
  name: string;
  desc: string;
  price: number;
  category: string;
  imageUrl?: string;
  tone?: string;
  isFeatured?: boolean;
  isPromo?: boolean;
  promoPrice?: number | null;
  active: boolean;
};

class MemoryStore {
  tables: MemoryTable[] = [];
  orders: MemoryOrder[] = [];
  waiterCalls: MemoryWaiterCall[] = [];
  musicRequests: MemoryMusicRequest[] = [];
  products: MemoryProduct[] = [];
  categories: string[] = [];
  waiters: MemoryWaiter[] = [];

  constructor() {
    this.init();
  }

  init() {
    // 30 mesas por padrão
    this.tables = Array.from({ length: 30 }, (_, index) => {
      const number = index + 1;
      return {
        id: `table-${number}`,
        number,
        qrToken: String(number),
        status: "AVAILABLE",
        currentSessionId: null,
        assignedWaiter: null,
        guests: [],
        orders: [],
        total: 0
      };
    });

    // Categorias padrão
    this.categories = [...defaultCategories];

    // Produtos padrão com IDs
    this.products = defaultMenuItems.map((item, idx) => ({
      id: `prod-${idx + 1}`,
      name: item.name,
      desc: item.desc,
      price: item.price,
      category: item.category,
      imageUrl: item.imageUrl,
      tone: item.tone,
      isFeatured: idx < 4,
      isPromo: idx === 0,
      promoPrice: idx === 0 ? 29.9 : null,
      active: true
    }));

    // Garçons padrão
    this.waiters = [
      {
        id: "waiter-1",
        name: "João",
        email: "joao@lendas.local",
        role: "WAITER",
        passwordHash: hashPassword("joao@2018")
      },
      {
        id: "waiter-2",
        name: "Maria",
        email: "maria@lendas.local",
        role: "WAITER",
        passwordHash: hashPassword("maria@2018")
      },
      {
        id: "waiter-3",
        name: "Pedro",
        email: "pedro@lendas.local",
        role: "WAITER",
        passwordHash: hashPassword("pedro@2018")
      }
    ];
  }

  findTable(tokenOrNumber: string | number): MemoryTable | undefined {
    const str = String(tokenOrNumber).trim();
    const num = parseInt(str, 10);
    return this.tables.find(
      (t) => t.qrToken === str || t.id === str || (!isNaN(num) && t.number === num)
    );
  }

  ensureTable(tokenOrNumber: string | number): MemoryTable {
    const existing = this.findTable(tokenOrNumber);
    if (existing) return existing;

    const num = parseInt(String(tokenOrNumber), 10) || (this.tables.length + 1);
    const newTable: MemoryTable = {
      id: `table-${num}`,
      number: num,
      qrToken: String(tokenOrNumber),
      status: "AVAILABLE",
      currentSessionId: null,
      assignedWaiter: null,
      guests: [],
      orders: [],
      total: 0
    };
    this.tables.push(newTable);
    this.tables.sort((a, b) => a.number - b.number);
    return newTable;
  }

  openTableSession(tokenOrNumber: string | number, guestName?: string): MemoryTable {
    const table = this.ensureTable(tokenOrNumber);
    if (!table.currentSessionId) {
      table.currentSessionId = `session-${table.number}-${Date.now()}`;
      table.openedAt = new Date().toISOString();
      table.status = "OCCUPIED";
    }
    if (guestName && !table.guests.includes(guestName.trim())) {
      table.guests.push(guestName.trim());
    }
    return table;
  }

  closeTable(tokenOrNumber: string | number): MemoryTable | undefined {
    const table = this.findTable(tokenOrNumber);
    if (!table) return undefined;

    table.status = "AVAILABLE";
    table.currentSessionId = null;
    table.guests = [];
    table.orders = [];
    table.total = 0;
    table.openedAt = undefined;

    // Resolve chamados abertos dessa mesa
    this.waiterCalls = this.waiterCalls.filter(
      (call) => call.tableNumber !== table.number
    );

    return table;
  }

  addOrder(
    tokenOrNumber: string | number,
    customerName: string,
    items: MemoryOrderItem[]
  ): MemoryOrder {
    const table = this.openTableSession(tokenOrNumber, customerName);
    const orderTotalCents = items.reduce(
      (sum, item) => sum + item.quantity * item.unitCents,
      0
    );

    const order: MemoryOrder = {
      id: `order-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tableNumber: table.number,
      tableToken: table.qrToken,
      customerName: customerName.trim(),
      items,
      totalCents: orderTotalCents,
      status: "PENDING",
      createdAt: new Date()
    };

    this.orders.unshift(order);
    table.orders.push(order);
    table.total += orderTotalCents;
    if (table.status !== "WAITING_BILL") {
      table.status = "OCCUPIED";
    }

    return order;
  }

  advanceOrderStatus(orderId: string): MemoryOrder | undefined {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return undefined;

    const nextStatus: Record<MemoryOrder["status"], MemoryOrder["status"]> = {
      PENDING: "PREPARING",
      PREPARING: "READY",
      READY: "DELIVERED",
      DELIVERED: "DELIVERED",
      CANCELLED: "CANCELLED"
    };

    order.status = nextStatus[order.status] ?? "DELIVERED";
    return order;
  }

  addWaiterCall(
    tokenOrNumber: string | number,
    customerName: string,
    type: "WAITER" | "BILL" = "WAITER"
  ): MemoryWaiterCall {
    const table = this.openTableSession(tokenOrNumber, customerName);

    if (type === "BILL") {
      table.status = "WAITING_BILL";
    }

    const call: MemoryWaiterCall = {
      id: `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tableNumber: table.number,
      tableToken: table.qrToken,
      customerName: customerName.trim(),
      type,
      status: "OPEN",
      createdAt: new Date()
    };

    this.waiterCalls.unshift(call);
    return call;
  }

  resolveWaiterCall(callId: string): boolean {
    const callIndex = this.waiterCalls.findIndex((c) => c.id === callId);
    if (callIndex === -1) return false;

    const call = this.waiterCalls[callIndex];
    call.status = "RESOLVED";
    this.waiterCalls.splice(callIndex, 1);

    // Se não há mais chamados de conta para essa mesa, volta status para OCCUPIED
    const remainingBill = this.waiterCalls.some(
      (c) => c.tableNumber === call.tableNumber && c.type === "BILL"
    );
    const table = this.findTable(call.tableNumber);
    if (table && !remainingBill && table.status === "WAITING_BILL") {
      table.status = table.currentSessionId ? "OCCUPIED" : "AVAILABLE";
    }

    return true;
  }

  addMusicRequest(
    tableToken: string,
    customerName: string,
    title: string,
    artist?: string,
    notes?: string
  ): MemoryMusicRequest {
    const req: MemoryMusicRequest = {
      id: `music-${Date.now()}`,
      tableToken,
      customerName,
      title: title.trim(),
      artist: artist?.trim(),
      notes: notes?.trim(),
      played: false,
      createdAt: new Date()
    };
    this.musicRequests.unshift(req);
    return req;
  }

  markMusicPlayed(id: string): boolean {
    const req = this.musicRequests.find((m) => m.id === id);
    if (!req) return false;
    req.played = true;
    return true;
  }
}

const globalForMemory = globalThis as unknown as {
  memoryStore?: MemoryStore;
};

export const memoryStore = globalForMemory.memoryStore ?? (globalForMemory.memoryStore = new MemoryStore());
