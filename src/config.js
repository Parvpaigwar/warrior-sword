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

  // "Buy" sends the customer to this WhatsApp chat with the order pre-filled
  // (country code + number, digits only).
  whatsappNumber: '919407161837',

  // Shipping charge shown at checkout (0 = free).
  shippingFee: 0,

  // DEV ONLY: true shows a 3D / Lite / Auto switch (and honours ?mode=) to compare
  // both modes. false = mode is always picked automatically per device (live).
  devModeToggle: false,

  instagramReel: 'https://www.instagram.com/reel/DcVy0TZIqpz/',
  instagramProfile: '',
  supportEmail: '',
};

export const fmt = (n) => STORE.currency + Number(n).toLocaleString('en-IN');
