import { globals as g } from "#config/globals.js";
import { sendToWhatsApp } from "./httpRequest/sendToWhatsApp.js";

class WhatsAppService {
  async sendMessage({ to, content, type }) {
    const data = {
      messaging_product: g.PRODUCT.WHATSAPP,
      to,
      type,
      ...content,
    };
    await sendToWhatsApp({ data });
  }

  async markAsRead(messageId) {
    const data = {
      messaging_product: g.PRODUCT.WHATSAPP,
      status: g.STATUS.READ,
      message_id: messageId,
    };
    await sendToWhatsApp({ data });
  }
}

export default new WhatsAppService();
