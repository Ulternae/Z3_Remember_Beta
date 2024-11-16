import axios from "axios";
import config from '#config/env.js';
import { globals as g } from "#config/globals.js";

const sendToWhatsApp = async ({ data }) => {
  const baseUrlMessages = `${config.BASE_URL}/${config.API_VERSION}/${config.BUSINESS_PHONE}/${g.TYPE_SERVICE.MESSAGES}`
  const headers = { Authorization: `Bearer ${config.API_TOKEN}` }

  try {
    await axios({
      method: 'POST',
      url: baseUrlMessages,
      headers,
      data
    })
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

export { sendToWhatsApp }