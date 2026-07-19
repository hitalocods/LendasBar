import { create } from "zustand";
import { persist } from "zustand/middleware";
import { menuItems } from "@/components/lendas/data";

export type OrderStatus = "Pendente" | "Confirmado" | "Em preparo" | "Pronto" | "Entregue";

export type TableUser = {
  id: string;
  name: string;
  active: boolean;
};

export type CartLine = {
  id: string;
  productName: string;
  customerName: string;
  quantity: number;
  unitPrice: number;
};

export type Order = {
  id: string;
  table: string;
  sessionId: string;
  guest: string;
  items: string[];
  total: number;
  status: OrderStatus;
  minutes: number;
};

type SubmitOrderInput = {
  customerName: string;
  tableLabel: string;
};

type LendasState = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    accent: string;
    logoUrl: string;
  };
  tableSession: {
    id: string;
    tableToken: string;
    tableNumber: string;
    status: "ACTIVE" | "CLOSING" | "CLOSED";
    activeUsers: TableUser[];
  };
  cart: CartLine[];
  waiterCalls: number;
  billRequests: number;
  orders: Order[];
  joinTable: (name: string, tableToken: string) => void;
  addToCart: (input: { productName: string; customerName: string; quantity: number; unitPrice: number }) => void;
  removeFromCart: (id: string) => void;
  submitOrder: (input: SubmitOrderInput) => void;
  advanceOrder: (id: string) => void;
  callWaiter: (customerName: string) => void;
  requestBill: (customerName: string) => void;
  closeSession: () => void;
};

const nextStatus: Record<OrderStatus, OrderStatus> = {
  Pendente: "Confirmado",
  Confirmado: "Em preparo",
  "Em preparo": "Pronto",
  Pronto: "Entregue",
  Entregue: "Entregue"
};

const featured = menuItems[1];

const createInitialState = () => ({
  restaurant: {
    id: "rest_lendas_2018",
    name: "LENDAS 2018",
    slug: "lendas-2018",
    accent: "#d71920",
    logoUrl: "/lendas-logo.png"
  },
  tableSession: {
    id: "sess_mesa_12_active",
    tableToken: "12",
    tableNumber: "12",
    status: "ACTIVE" as const,
    activeUsers: []
  },
  cart: [],
  waiterCalls: 0,
  billRequests: 0,
  orders: []
});

export const useLendasStore = create<LendasState>()(
  persist(
    (set) => ({
      ...createInitialState(),
      joinTable: (name, tableToken) =>
        set((state) => {
          const trimmedName = name.trim();
          const isNewTable = state.tableSession.tableToken !== tableToken;
          const isClosed = state.tableSession.status === "CLOSED";
          const existingUser =
            !isNewTable &&
            !isClosed &&
            state.tableSession.activeUsers.find(
              (user) => user.name.toLowerCase() === trimmedName.toLowerCase()
            );

          return {
            cart: isNewTable || isClosed ? [] : state.cart,
            tableSession: {
              ...state.tableSession,
              tableToken,
              tableNumber: tableToken,
              status: "ACTIVE",
              activeUsers: existingUser
                ? state.tableSession.activeUsers
                : [
                    ...(isNewTable || isClosed ? [] : state.tableSession.activeUsers),
                    {
                      id: `user_${trimmedName.toLowerCase()}_${Date.now()}`,
                      name: trimmedName,
                      active: true
                    }
                  ]
            }
          };
        }),
      addToCart: ({ productName, customerName, quantity, unitPrice }) =>
        set((state) => ({
          cart: [
            ...state.cart,
            {
              id: `cart_${Date.now()}`,
              productName,
              customerName,
              quantity,
              unitPrice
            }
          ]
        })),
      removeFromCart: (id) =>
        set((state) => ({
          cart: state.cart.filter((line) => line.id !== id)
        })),
      submitOrder: ({ customerName, tableLabel }) =>
        set((state) => {
          const customerLines = state.cart.filter((line) => line.customerName === customerName);
          const lines = customerLines.length
            ? customerLines
            : [
                {
                  id: "fallback_line",
                  productName: featured.name,
                  customerName,
                  quantity: 1,
                  unitPrice: featured.price
                }
              ];

          return {
            cart: state.cart.filter((line) => line.customerName !== customerName),
            orders: [
              {
                id: `#${1260 + state.orders.length}`,
                table: tableLabel,
                sessionId: state.tableSession.id,
                guest: customerName,
                items: lines.map((line) => `${line.quantity}x ${line.productName}`),
                total: lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0),
                status: "Pendente",
                minutes: 0
              },
              ...state.orders
            ]
          };
        }),
      advanceOrder: (id) =>
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === id ? { ...order, status: nextStatus[order.status] } : order
          )
        })),
      callWaiter: () => set((state) => ({ waiterCalls: state.waiterCalls + 1 })),
      requestBill: () =>
        set((state) => ({
          billRequests: state.billRequests + 1,
          tableSession: { ...state.tableSession, status: "CLOSING" }
        })),
      closeSession: () =>
        set((state) => ({
          tableSession: {
            ...state.tableSession,
            id: `sess_${state.tableSession.tableToken}_${Date.now()}`,
            status: "CLOSED",
            activeUsers: []
          },
          cart: []
        }))
    }),
    {
      name: "lendas-table-session",
      version: 2,
      migrate: () => createInitialState(),
      partialize: (state) => ({
        tableSession: state.tableSession,
        cart: state.cart
      })
    }
  )
);
