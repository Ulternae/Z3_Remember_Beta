import whatsappService from "./whatsappService.js";
import { globals as g } from "#config/globals.js";
import { appendToSheet } from "./googleSheetsService.js";
import { openAiService } from "./openAiService.js"

class MessageHandler {
  constructor() {
    this.appointmentState = {};
    this.assistantState = {};
  }

  async handleIncomingMessage(message, senderInfo) {
    const type = message?.type;
    const isTypeText = type === g.TYPE_MESSAGE.TEXT;
    const isTypeInterative = type === g.TYPE_MESSAGE.INTERACTIVE;
    const incomingMessage = message?.text?.body?.toLowerCase()?.trim() || "";

    const matchedActions = isTypeText
      ? Object.values(g.ACTIONS).filter((v) => incomingMessage.includes(v))
      : [];
    const isMedia = matchedActions.length > 0;
    const typeRequest = matchedActions[0];

    if (isTypeText && isMedia) {
      await this.sendMedia({ to: message.from, type: typeRequest });
      await whatsappService.markAsRead(message.id);
      return;
    }

    if (isTypeText) {
      const username = this.getSenderName({ senderInfo });

      if (this.isGreeting(incomingMessage)) {
        await this.sendWelcomeMessage({ to: message.from, senderInfo });
        await this.sendWelcomeMenu({ to: message.from });
        return;
      } else if (this.assistantState[message.from]) {
        await this.handleAssistandFlow({
          to: message.from,
          message: incomingMessage,
        });
        return;
      } else if (this.appointmentState[message.from]) {
        await this.handleAppointmentFlow({
          to: message.from,
          message: incomingMessage,
        });
        return;
      } else {
        const content = {
          text: {
            body: `Echo for ${username.toLowerCase()} : ${message?.text?.body}`,
          },
          context: {
            message_id: message.id,
          },
        };

        await whatsappService.sendMessage({
          to: message.from,
          type: g.TYPE_MESSAGE.TEXT,
          content,
        });
        await whatsappService.markAsRead(message.id);
        return;
      }
    }

    if (isTypeInterative) {
      const optionId = message?.interactive?.button_reply?.id;
      await this.handleMenuOption({ to: message.from, optionId });
      await whatsappService.markAsRead(message.id);
    }
  }

  isGreeting(message) {
    return g.GREATINGS.some((g) => message.includes(g));
  }

  getSenderName({ senderInfo }) {
    return senderInfo?.profile?.name?.split(" ")[0] || senderInfo.wa_id || "";
  }

  async sendWelcomeMessage({ senderInfo, to }) {
    const username = this.getSenderName({ senderInfo });
    const welcomeMessage = {
      text: {
        body: `Hola, bienvenido ${username} a nuestro servicio Remember, ¿En que puedo ayudarte hoy?`,
      },
    };
    await whatsappService.sendMessage({
      to,
      type: g.TYPE_MESSAGE.TEXT,
      content: welcomeMessage,
    });
  }

  async sendWelcomeMenu({ to }) {
    const menuMessage = "Elige una option";
    const buttonsMenu = [
      { type: "reply", reply: { id: "option_1", title: "Agendar" } },
      { type: "reply", reply: { id: "option_2", title: "Consultar" } },
      { type: "reply", reply: { id: "option_3", title: "Ubicacion" } },
    ];

    const content = {
      interactive: {
        type: "button",
        body: { text: menuMessage },
        action: {
          buttons: buttonsMenu,
        },
      },
    };

    await whatsappService.sendMessage({
      to,
      type: g.TYPE_MESSAGE.INTERACTIVE,
      content,
    });
  }

  async handleMenuOption({ to, optionId }) {
    let response;
    switch (optionId) {
      case "option_1":
        this.appointmentState[to] = { step: "name" };
        response = "Por favor, ingresa tu nombre";
        break;
      case "option_2":
        this.assistantState[to] = { step: "question" };
        response = "Por favor, escribe tu pregunta.";
        break;
      case "option_3":
        response = "Te esperamos en nuestra sucursal mas cercana";
        await this.sendLocation({ to })
        break;
      case "option_6":
        response =
          "Esto es una emergencia, te invitamos a llamar a la linea de atencion";
        await this.sendContact({ to });
        break;
      default:
        response = "No entendimos tu solicutud";
        break;
    }

    const content = { text: { body: response } };

    await whatsappService.sendMessage({
      to,
      content,
      type: g.TYPE_MESSAGE.TEXT,
    });
  }

  async sendMedia({ to, type }) {
    const contentMedia = {
      audio: {
        link: "https://s3.amazonaws.com/gndx.dev/medpet-audio.aac",
      },
      image: {
        link: "https://s3.amazonaws.com/gndx.dev/medpet-imagen.png",
        caption: "¡Esto es una Imagen!",
      },
      video: {
        link: "https://s3.amazonaws.com/gndx.dev/medpet-video.mp4",
        caption: "¡Esto es una video!",
      },
      document: {
        link: "https://s3.amazonaws.com/gndx.dev/medpet-file.pdf",
        caption: "¡Esto es un PDF!",
        filename: "A webo",
      },
    };

    const content = {
      [type]: contentMedia[type],
    };

    if (!contentMedia[type]) {
      console.error(`Invalid media type: ${type}`);
      return;
    }

    await whatsappService.sendMessage({ to, content, type });
    return;
  }

  completeAppointment({ to }) {
    const appointment = this.appointmentState[to];
    delete this.appointmentState[to];

    const userData = [
      to,
      appointment.name,
      appointment.petName,
      appointment.petType,
      appointment.reason,
      new Date().toISOString(),
    ];

    appendToSheet({ data: userData });

    return `Gracias por agendar tu cita, verifica los datos: 
    Nombre: ${appointment.name}
    Nombre de la mascota: ${appointment.petName}
    Tipo de mascota: ${appointment.petType}
    Motivo: ${appointment.reason}
    
    Nos pondremos en contacto contigo pronto para confirmar la fecha y hora de tu cita.
    `;
  }

  async handleAppointmentFlow({ to, message }) {
    if (!this.appointmentState[to]) {
      this.appointmentState[to] = { step: "name" };
    }

    const state = this.appointmentState[to];
    let response;

    switch (state.step) {
      case "name":
        state.name = message;
        state.step = "petName";
        response = "Gracias, Ahora, ¿Cuál es el nombre de tu Mascota?";
        break;
      case "petName":
        state.petName = message;
        state.step = "petType";
        response =
          "¿Qué tipo de mascota es? (por ejemplo: perro, gato, huron, etc.)";
        break;
      case "petType":
        state.petType = message;
        state.step = "reason";
        response = "¿Cuál es el motivo de la Consulta?";
        break;
      case "reason":
        state.reason = message;
        response = this.completeAppointment({ to });
        break;
      default:
        response = "No entiendo tu respuesta.";
        break;
    }

    const content = {
      text: { body: response },
    };
    await whatsappService.sendMessage({
      to,
      type: g.TYPE_MESSAGE.TEXT,
      content,
    });
  }

  async handleAssistandFlow({ to, message }) {
    const state = this.assistantState[to];
    let response;

    if (state && state.step === "question") {
      response = await openAiService({ message });
    } else {
      response = "No entendí tu solicitud. Por favor, intenta de nuevo.";
    }

    const messageSatisfactory = "¿La respuesta fue de tu ayuda?";
    const buttonsSatisfactory = [
      { type: "reply", reply: { id: "option_4", title: "Si" } },
      { type: "reply", reply: { id: "option_5", title: "Nop" } },
      { type: "reply", reply: { id: "option_6", title: "Emergencia" } },
    ];

    delete this.assistantState[to];

    const contentMessage = { text: { body: response } };

    const contentInteractive = {
      interactive: {
        type: "button",
        body: { text: messageSatisfactory },
        action: {
          buttons: buttonsSatisfactory,
        },
      },
    };

    await whatsappService.sendMessage({
      to,
      content: contentMessage,
      type: g.TYPE_MESSAGE.TEXT,
    });

    await whatsappService.sendMessage({
      to,
      content: contentInteractive,
      type: g.TYPE_MESSAGE.INTERACTIVE,
    });
  }

  async sendContact({ to }) {
    const contact = {
      addresses: [
        {
          street: "123 Calle de las Mascotas",
          city: "Ciudad",
          state: "Estado",
          zip: "12345",
          country: "País",
          country_code: "PA",
          type: "WORK",
        },
      ],
      emails: [
        {
          email: "contacto@medpet.com",
          type: "WORK",
        },
      ],
      name: {
        formatted_name: "MedPet Contacto",
        first_name: "MedPet",
        last_name: "Contacto",
        middle_name: "",
        suffix: "",
        prefix: "",
      },
      org: {
        company: "MedPet",
        department: "Atención al Cliente",
        title: "Representante",
      },
      phones: [
        {
          phone: "+1234567890",
          wa_id: "1234567890",
          type: "WORK",
        },
      ],
      urls: [
        {
          url: "https://www.medpet.com",
          type: "WORK",
        },
      ],
    };

    const content = { contacts: [contact] };
    await whatsappService.sendMessage({
      to,
      content,
      type: g.TYPE_MESSAGE.CONTACTS,
    });
  }

  async sendLocation({ to }) {
    const latitude = 6.2071694;
    const longitude = -75.574607;
    const name = "Medellin z3";
    const address = "Cra 43A #5A - 113, El Poblado, Medellín Antioquia";

    const locationMessage = {
      location: {
        latitude,
        longitude,
        name,
        address,
      },
    };
    await whatsappService.sendMessage({ to, content: locationMessage, type: g.TYPE_MESSAGE.LOCATION });
  }
}

export default new MessageHandler();
