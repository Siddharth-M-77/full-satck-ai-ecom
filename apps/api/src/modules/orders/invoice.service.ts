import PDFDocument from 'pdfkit';
import { IOrder } from './order.model.js';
import { env } from '../../config/env.js';

function text(value: unknown, fallback = '-'): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function addressLines(address: Record<string, unknown> | undefined): string[] {
  if (!address) return [];
  return [
    text(address.fullName, ''),
    text(address.addressLine1, ''),
    text(address.addressLine2, ''),
    [text(address.city, ''), text(address.state, ''), text(address.postalCode, '')].filter(Boolean).join(', '),
    text(address.country, ''),
    address.phone ? `Phone: ${String(address.phone)}` : '',
  ].filter(Boolean);
}

export class InvoiceService {
  static async generate(order: IOrder, buyerEmail?: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: {
        Title: `Invoice ${order.orderNumber}`,
        Author: env.STORE_LEGAL_NAME,
        Subject: `Order invoice ${order.orderNumber}`,
      } });
      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      const left = 48;
      const right = 547;
      const width = right - left;
      const sellerAddress = env.STORE_ADDRESS?.trim();
      const buyerAddress = addressLines(order.shippingAddress as Record<string, unknown>);
      const issuedAt = order.createdAt.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });

      document.rect(0, 0, 612, 150).fill('#123b32');
      document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(env.STORE_LEGAL_NAME, left, 44, { width: 310 });
      document.fillColor('#c5e1d5').font('Helvetica').fontSize(9).text('ORDER INVOICE', left, 76);
      document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('INVOICE', 400, 44, { width: 147, align: 'right' });
      document.fillColor('#d8e8e1').font('Helvetica').fontSize(9)
        .text(`Invoice no.  ${order.orderNumber}`, 350, 76, { width: 197, align: 'right' })
        .text(`Issued  ${issuedAt}`, 350, 92, { width: 197, align: 'right' });

      let y = 176;
      const blockWidth = 235;
      document.fillColor('#61716c').font('Helvetica-Bold').fontSize(8).text('SOLD BY', left, y);
      document.fillColor('#15231f').font('Helvetica-Bold').fontSize(11).text(env.STORE_LEGAL_NAME, left, y + 15, { width: blockWidth });
      let sellerY = y + 33;
      if (sellerAddress) {
        document.fillColor('#475650').font('Helvetica').fontSize(9).text(sellerAddress, left, sellerY, { width: blockWidth, lineGap: 3 });
        sellerY = document.y + 5;
      }
      if (env.STORE_GSTIN) {
        document.fillColor('#475650').font('Helvetica').fontSize(9).text(`GSTIN: ${env.STORE_GSTIN}`, left, sellerY, { width: blockWidth });
        sellerY = document.y + 3;
      }
      const supportEmail = env.STORE_SUPPORT_EMAIL || env.EMAIL_FROM;
      document.fillColor('#475650').font('Helvetica').fontSize(9).text(`Support: ${supportEmail}`, left, sellerY, { width: blockWidth });

      document.fillColor('#61716c').font('Helvetica-Bold').fontSize(8).text('BILL TO / SHIP TO', 320, y);
      document.fillColor('#15231f').font('Helvetica-Bold').fontSize(10)
        .text(buyerAddress[0] || 'Customer', 320, y + 15, { width: blockWidth });
      document.fillColor('#475650').font('Helvetica').fontSize(9)
        .text(buyerAddress.slice(1).join('\n'), 320, y + 31, { width: blockWidth, lineGap: 3 });
      if (buyerEmail) {
        document.text(buyerEmail, 320, document.y + 3, { width: blockWidth });
      }

      y = Math.max(document.y, sellerY) + 28;
      document.moveTo(left, y).lineTo(right, y).strokeColor('#d7dfdb').stroke();
      y += 18;

      const columns = { description: left + 8, sku: 298, qty: 390, rate: 434, amount: 493 };
      const drawTableHeader = () => {
        document.rect(left, y, width, 26).fill('#edf3ef');
        document.fillColor('#33453d').font('Helvetica-Bold').fontSize(8)
          .text('ITEM DESCRIPTION', columns.description, y + 9, { width: 230 })
          .text('QTY', columns.qty, y + 9, { width: 32, align: 'right' })
          .text('UNIT PRICE', columns.rate, y + 9, { width: 55, align: 'right' })
          .text('AMOUNT', columns.amount, y + 9, { width: 54, align: 'right' });
        y += 26;
      };
      drawTableHeader();

      for (const item of order.items) {
        document.font('Helvetica').fontSize(9);
        const descriptionHeight = document.heightOfString(item.title, { width: 225 });
        const rowHeight = Math.max(34, descriptionHeight + 18);
        if (y + rowHeight > 710) {
          document.addPage();
          y = 48;
          drawTableHeader();
        }
        document.fillColor('#18251f').font('Helvetica').fontSize(9)
          .text(item.title, columns.description, y + 9, { width: 225 });
        document.fillColor('#798680').fontSize(7)
          .text(`SKU: ${item.sku}`, columns.description, y + 12 + descriptionHeight, { width: 225 });
        document.fillColor('#35443d').fontSize(9)
          .text(String(item.quantity), columns.qty, y + 10, { width: 32, align: 'right' })
          .text(item.unitPrice.toLocaleString('en-IN'), columns.rate, y + 10, { width: 55, align: 'right' })
          .font('Helvetica-Bold')
          .text(item.subtotal.toLocaleString('en-IN'), columns.amount, y + 10, { width: 54, align: 'right' });
        y += rowHeight;
        document.moveTo(left, y).lineTo(right, y).strokeColor('#edf0ee').stroke();
      }

      if (y + 170 > 710) {
        document.addPage();
        y = 48;
      }
      y += 20;
      const summaryX = 335;
      const summaryValueX = 465;
      const summaryRow = (label: string, value: string, bold = false) => {
        document.fillColor(bold ? '#17251f' : '#59665f')
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(bold ? 11 : 9)
          .text(label, summaryX, y, { width: 125 })
          .text(value, summaryValueX, y, { width: 82, align: 'right' });
        y += bold ? 23 : 18;
      };

      summaryRow('Items subtotal', `INR ${order.pricing.itemsTotal.toLocaleString('en-IN')}`);
      if (order.pricing.discountTotal > 0) {
        summaryRow('Discount', `- INR ${order.pricing.discountTotal.toLocaleString('en-IN')}`);
      }
      summaryRow('Shipping', order.pricing.shippingFee === 0 ? 'FREE' : `INR ${order.pricing.shippingFee.toLocaleString('en-IN')}`);
      if (order.pricing.taxTotal > 0) {
        summaryRow('Tax collected', `INR ${order.pricing.taxTotal.toLocaleString('en-IN')}`);
      }
      document.moveTo(summaryX, y - 3).lineTo(right, y - 3).strokeColor('#9aa9a1').stroke();
      summaryRow('TOTAL', `INR ${order.pricing.grandTotal.toLocaleString('en-IN')}`, true);

      y += 14;
      document.roundedRect(left, y, width, 48, 4).fill('#f2f6f3');
      document.fillColor('#526159').font('Helvetica-Bold').fontSize(8).text('PAYMENT', left + 13, y + 11);
      document.fillColor('#17251f').font('Helvetica').fontSize(9)
        .text(`${order.paymentMethod} · ${order.status.replaceAll('_', ' ')}`, left + 13, y + 25, { width: 210 });
      document.fillColor('#526159').font('Helvetica-Bold').fontSize(8).text('ORDER REFERENCE', left + 270, y + 11);
      document.fillColor('#17251f').font('Helvetica').fontSize(9).text(order.orderNumber, left + 270, y + 25, { width: 210 });

      const range = document.bufferedPageRange();
      for (let index = range.start; index < range.start + range.count; index += 1) {
        document.switchToPage(index);
        document.moveTo(left, 760).lineTo(right, 760).strokeColor('#d7dfdb').stroke();
        document.fillColor('#718078').font('Helvetica').fontSize(8)
          .text(`${env.STORE_LEGAL_NAME} · Thank you for shopping with us`, left, 772, { width, align: 'center' });
        document.fillColor('#718078').fontSize(8)
          .text(`Page ${index + 1} of ${range.count}`, left, 786, { width, align: 'right' });
      }
      document.end();
    });
  }
}
