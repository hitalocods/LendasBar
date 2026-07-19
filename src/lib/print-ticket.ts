export type PrintTicketItem = {
  label: string;
  quantity?: number;
  unitCents?: number;
  totalCents: number;
};

export type PrintTicketOptions = {
  title?: string;
  tableNumber: number | string;
  customerNames?: string[];
  items: PrintTicketItem[];
  totalCents: number;
  restaurantName?: string;
};

export function printTicket({
  title = "RECIBAO DE COMANDA",
  tableNumber,
  customerNames = [],
  items = [],
  totalCents,
  restaurantName = "LENDAS 2018"
}: PrintTicketOptions) {
  if (typeof window === "undefined") return;

  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) return;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const timeFormatted = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const totalFormatted = (totalCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  const itemsHtml = items
    .map((item) => {
      const priceFormatted = (item.totalCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
      return `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px;">
          <span>${item.label}</span>
          <span style="font-weight: bold;">${priceFormatted}</span>
        </div>
      `;
    })
    .join("");

  const guestsHtml = customerNames.length
    ? `<p style="margin: 2px 0 6px 0; font-size: 12px; color: #444;">Clientes: ${customerNames.join(", ")}</p>`
    : "";

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Comanda - Mesa ${tableNumber}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          @media print {
            html, body {
              width: 78mm;
              margin: 0 auto;
            }
            /* Esconde cabeçalho/rodapé automático de URLs do navegador */
            header, footer, nav { display: none !important; }
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 76mm;
            margin: 0 auto;
            padding: 8px 4px;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .header { margin-bottom: 8px; }
          .footer { margin-top: 15px; font-size: 11px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header center">
          <h2 style="margin: 0; font-size: 18px;" class="bold">${restaurantName}</h2>
          <p style="margin: 2px 0; font-size: 11px;">${title}</p>
          <div class="divider"></div>
          <h3 style="margin: 4px 0; font-size: 20px;" class="bold">MESA ${tableNumber}</h3>
          <p style="margin: 2px 0; font-size: 11px;">Data: ${dateFormatted} às ${timeFormatted}</p>
          ${guestsHtml}
        </div>

        <div class="divider"></div>
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 6px;">
            <span>ITEM</span>
            <span>VALOR</span>
          </div>
          ${itemsHtml}
        </div>

        <div class="divider"></div>
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 6px;">
          <span>TOTAL A PAGAR:</span>
          <span>${totalFormatted}</span>
        </div>

        <div class="divider"></div>
        <div class="footer">
          <p style="margin: 2px 0;">Obrigado pela preferência!</p>
          <p style="margin: 2px 0; font-weight: bold;">Volte Sempre ao LENDAS 2018</p>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
}
