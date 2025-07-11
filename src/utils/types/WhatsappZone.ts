import { AdminZones } from 'src/utils/types';

export const WhatsappCoachByZone = {
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
  // Pas encore de groupe WhatsApp COACH pour Sud-ouest
  [AdminZones.SUDOUEST]: {
    name: 'Entourage Pro France',
    qr: '/static/img/whatsapp-qrcode-coach/whatsapp-qrcode-hz.png',
    url: process.env.WHATSAPP_COACH_URL_HZ as string,
  },
  [AdminZones.HZ]: {
    name: 'Entourage Pro France',
    qr: '/static/img/whatsapp-qrcode-coach/whatsapp-qrcode-hz.png',
    url: process.env.WHATSAPP_COACH_URL_HZ as string,
  },
};

export const WhatsappCandidateByZone = {
  [AdminZones.PARIS]: {
    name: 'IDF // Paris, 92, 93',
    qr: '/static/img/whatsapp-qrcode-candidat/whatsapp-qrcode-paris.png',
    url: process.env.WHATSAPP_CANDIDAT_URL_PARIS as string,
  },
  [AdminZones.LYON]: {
    name: 'Rhône // Lyon',
    qr: '/static/img/whatsapp-qrcode-candidat/whatsapp-qrcode-lyon.png',
    url: process.env.WHATSAPP_CANDIDAT_URL_LYON as string,
  },
  [AdminZones.LILLE]: {
    name: 'Nord // Lille',
    qr: '/static/img/whatsapp-qrcode-candidat/whatsapp-qrcode-lille.png',
    url: process.env.WHATSAPP_CANDIDAT_URL_LILLE as string,
  },
  [AdminZones.RENNES]: {
    name: 'Bretagne // Rennes & Lorient',
    qr: '/static/img/whatsapp-qrcode-candidat/whatsapp-qrcode-rennes-lorient.png',
    url: process.env.WHATSAPP_CANDIDAT_URL_RENNES_LORIENT as string,
  },
  [AdminZones.LORIENT]: {
    name: 'Bretagne // Rennes & Lorient',
    qr: '/static/img/whatsapp-qrcode-candidat/whatsapp-qrcode-rennes-lorient.png',
    url: process.env.WHATSAPP_CANDIDAT_URL_RENNES_LORIENT as string,
  },
  [AdminZones.SUDOUEST]: {
    name: 'Sud-ouest',
    qr: '/static/img/whatsapp-qrcode-candidat/whatsapp-qrcode-sudouest.png',
    url: process.env.WHATSAPP_CANDIDAT_URL_SUDOUEST as string,
  },
  [AdminZones.HZ]: {
    name: 'Entourage Pro France',
    qr: '/static/img/whatsapp-qrcode-candidat/whatsapp-qrcode-hz.png',
    url: process.env.WHATSAPP_CANDIDAT_URL_HZ as string,
  },
};
