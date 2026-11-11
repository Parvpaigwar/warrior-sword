// ─────────────────────────────────────────────────────────────
//  Store settings — edit these before going live.
// ─────────────────────────────────────────────────────────────
export const STORE = {
  brand: 'The Warrior Sword',
  product: {
    id: 'warrior-sword-plaque',
    name: 'The Warrior Sword',
    subtitle: 'Fantasy dragon display sword with walnut wall plaque',
    price: 2499, // INR
    maxQty: 5,
    image: '/images/studio-mounted.webp',
  },
  currency: '₹',

  // Orders are sent to this WhatsApp number (country code + number, digits only),
  // e.g. '919876543210'. Leave empty to only show the on-site confirmation.
  whatsappNumber: '',

  // Shipping charge shown at checkout (0 = free).
  shippingFee: 0,

  instagramReel: 'https://www.instagram.com/reel/DcVy0TZIqpz/',
  instagramProfile: '',
  supportEmail: '',
};

export const fmt = (n) => STORE.currency + Number(n).toLocaleString('en-IN');
