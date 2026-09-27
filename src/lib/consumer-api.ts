/**
 * Serviço de Integração Oficial com a API do Programa Consumer (PDV)
 * Especificação Oficial da API de Parceiros B2B do Consumer
 */

export interface ConsumerMerchant {
  id: string;
  name: string;
}

export interface ConsumerCustomer {
  id?: string;
  name: string;
  phone?: {
    number: string;
    localizer?: string;
    localizerExpiration?: string;
  };
}

export interface ConsumerItem {
  id: string;
  externalCode: string;
  name: string;
  quantity: number;
  unitPrice: {
    value: number;
    currency: string;
  };
  totalPrice: {
    value: number;
    currency: string;
  };
  observations?: string;
}

export interface ConsumerPaymentMethod {
  method: string;
  type: string;
  currency: string;
  value: number;
}

export interface ConsumerPayments {
  pending: number;
  prepaid: number;
  methods: ConsumerPaymentMethod[];
}

export interface OfficialConsumerOrderPayload {
  id: string;
  displayId: string;
  orderType: "INDOOR" | "DELIVERY" | "TAKEOUT";
  salesChannel: string;
  orderTiming: "IMMEDIATE";
  createdAt: string;
  preparationStartDateTime: string;
  merchant: ConsumerMerchant;
  customer: ConsumerCustomer;
  items: ConsumerItem[];
  payments: ConsumerPayments;
  total: {
    subTotal: number;
    deliveryFee: number;
    orderAmount: number;
    benefits: number;
    additionalFees: number;
  };
}

export interface ConsumerEvent {
  id: string;
  orderId: string;
  createdAt: string;
  fullCode: "PLACED" | "ORDER_DETAILS_REQUESTED" | "CONFIRMED" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
  code: "PLC" | "ODR" | "CFM" | "PRP" | "RDY" | "DLV" | "CAN";
}

export interface ConsumerOrderResult {
  success: boolean;
  consumerOrderId?: string;
  error?: string;
}

const CONSUMER_API_URL = process.env.CONSUMER_API_URL || "https://b2b.programaconsumer.com.br/api/v1";
const CONSUMER_API_KEY = process.env.CONSUMER_API_KEY || "";

/**
 * Converte um pedido do banco de dados do Lendas Bar no Payload Oficial do Consumer
 */
export function mapOrderToConsumerPayload(order: {
  id: string;
  restaurantId: string;
  restaurantName?: string;
  customerName: string;
  tableNumber?: number;
  createdAt: Date;
  items: Array<{
    id: string;
    productName: string;
    productCode?: string | null;
    quantity: number;
    unitCents: number;
    notes?: string | null;
  }>;
}): OfficialConsumerOrderPayload {
  const subTotal = order.items.reduce((sum, item) => sum + (item.quantity * item.unitCents) / 100, 0);

  return {
    id: order.id,
    displayId: order.tableNumber ? String(order.tableNumber) : order.id.slice(-4),
    orderType: "INDOOR",
    salesChannel: process.env.CONSUMER_SALES_CHANNEL || "LENDAS_BAR",
    orderTiming: "IMMEDIATE",
    createdAt: order.createdAt.toISOString(),
    preparationStartDateTime: order.createdAt.toISOString(),
    merchant: {
      id: order.restaurantId,
      name: order.restaurantName || process.env.CONSUMER_MERCHANT_NAME || "LENDAS 2018"
    },
    customer: {
      id: `cust_${order.customerName.toLowerCase().replace(/\s+/g, "_")}`,
      name: order.customerName
    },
    items: order.items.map((item) => {
      const unitValue = item.unitCents / 100;
      const totalValue = unitValue * item.quantity;
      // Sanitize externalCode: normalize accents and replace spaces/special chars
      const sanitizedName = item.productName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      return {
        id: item.id,
        externalCode: item.productCode || sanitizedName || item.id,
        name: item.productName,
        quantity: item.quantity,
        unitPrice: {
          value: unitValue,
          currency: "BRL"
        },
        totalPrice: {
          value: totalValue,
          currency: "BRL"
        },
        observations: item.notes || ""
      };
    }),
    payments: {
      pending: subTotal,
      prepaid: 0,
      methods: [
        {
          method: "CASH",
          type: "PENDING",
          currency: "BRL",
          value: subTotal
        }
      ]
    },
    total: {
      subTotal,
      deliveryFee: 0,
      orderAmount: subTotal,
      benefits: 0,
      additionalFees: 0
    }
  };
}

/**
 * Envia um pedido realizado no Lendas Bar para a API do Programa Consumer (PDV)
 */
export async function sendOrderToConsumer(orderData: {
  id: string;
  restaurantId: string;
  restaurantName?: string;
  customerName: string;
  tableNumber?: number;
  createdAt: Date;
  items: Array<{
    id: string;
    productName: string;
    productCode?: string | null;
    quantity: number;
    unitCents: number;
    notes?: string | null;
  }>;
}): Promise<ConsumerOrderResult> {
  if (!CONSUMER_API_KEY) {
    console.warn("[Consumer API] CONSUMER_API_KEY não configurado no .env. Pedido mantido localmente.");
    return {
      success: false,
      error: "CONSUMER_API_KEY_NOT_CONFIGURED"
    };
  }

  const payload = mapOrderToConsumerPayload(orderData);

  try {
    const response = await fetch(`${CONSUMER_API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONSUMER_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Consumer API Error]:", response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = (await response.json()) as { id?: string; id_consumer?: string };
    return {
      success: true,
      consumerOrderId: data.id_consumer || data.id || payload.id
    };
  } catch (error) {
    console.error("[Consumer API Exception]:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "NETWORK_ERROR"
    };
  }
}
