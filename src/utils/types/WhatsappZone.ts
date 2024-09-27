import { AdminZones } from 'src/utils/types';

export const WhatsappByZone = {
  [AdminZones.PARIS]: {
    name: 'IDF // Paris, 92, 93',
    qr: '/static/img/whatsapp-qrcode-coach/whatsapp-qrcode-paris.png',
    url: process.env.WHATSAPP_COACH_URL_PARIS as string,
  },
  [AdminZones.LYON]: {
    name: 'Rhône // Lyon',
    qr: '/static/img/whatsapp-qrcode-coach/whatsapp-qrcode-lyon.png',
    url: process.env.WHATSAPP_COACH_URL_LYON as string,
  },
  [AdminZones.LILLE]: {
    name: 'Nord // Lille',
    qr: '/static/img/whatsapp-qrcode-coach/whatsapp-qrcode-lille.png',
    url: process.env.WHATSAPP_COACH_URL_LILLE as string,
  },
  [AdminZones.RENNES]: {
    name: 'Bretagne // Rennes & Lorient',
    qr: '/static/img/whatsapp-qrcode-coach/whatsapp-qrcode-rennes-lorient.png',
    url: process.env.WHATSAPP_COACH_URL_RENNES_LORIENT as string,
  },
  [AdminZones.LORIENT]: {
    name: 'Bretagne // Rennes & Lorient',
    qr: '/static/img/whatsapp-qrcode-coach/whatsapp-qrcode-rennes-lorient.png',
    url: process.env.WHATSAPP_COACH_URL_RENNES_LORIENT as string,
  },
  [AdminZones.HZ]: {
    name: 'Entourage Pro France',
    qr: '/static/img/whatsapp-qrcode-coach/whatsapp-qrcode-hz.png',
    url: process.env.WHATSAPP_COACH_URL_HZ as string,
  },
};
