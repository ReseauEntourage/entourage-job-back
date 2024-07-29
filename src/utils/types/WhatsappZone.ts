import { AdminZones } from 'src/utils/types';

export const WhatsappByZone = {
  [AdminZones.PARIS]: {
    name: 'IDF // Paris, 92, 93',
    qrcode_url: process.env.WHATSAPP_COACH_QRCODE_PARIS as string,
    url: process.env.WHATSAPP_COACH_URL_PARIS as string,
  },
  [AdminZones.LYON]: {
    name: 'Rhône // Lyon',
    qrcode_url: process.env.WHATSAPP_COACH_QRCODE_LYON as string,
    url: process.env.WHATSAPP_COACH_URL_LYON as string,
  },
  [AdminZones.LILLE]: {
    name: 'Nord // Lille',
    qrcode_url: process.env.WHATSAPP_COACH_QRCODE_LILLE as string,
    url: process.env.WHATSAPP_COACH_URL_LILLE as string,
  },
  [AdminZones.RENNES]: {
    name: 'Bretagne // Rennes & Lorient',
    qrcode_url: process.env.WHATSAPP_COACH_QRCODE_RENNES_ORIENT as string,
    url: process.env.WHATSAPP_COACH_URL_RENNES_ORIENT as string,
  },
  [AdminZones.LORIENT]: {
    name: 'Bretagne // Rennes & Lorient',
    qrcode_url: process.env.WHATSAPP_COACH_QRCODE_RENNES_LORIENT as string,
    url: process.env.WHATSAPP_COACH_URL_RENNES_LORIENT as string,
  },
  [AdminZones.HZ]: {
    name: 'Entourage Pro France',
    qrcode_url: process.env.WHATSAPP_COACH_QRCODE_HZ as string,
    url: process.env.WHATSAPP_COACH_URL_HZ as string,
  },
};
