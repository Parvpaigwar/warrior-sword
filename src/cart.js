// Cart drawer + WhatsApp ordering: "Buy" opens a WhatsApp chat with the order pre-filled.
import { STORE, fmt } from './config.js';

const KEY = 'warrior-cart-v1';
const P = STORE.product;
const $ = (s, r = document) => r.querySelector(s);

function load() {
  try { const q = JSON.parse(localStorage.getItem(KEY))?.qty; return Number.isInteger(q) ? Math.max(0, Math.min(P.maxQty, q)) : 0; }
  catch { return 0; }
}
function save(qty) { try { localStorage.setItem(KEY, JSON.stringify({ qty })); } catch { /* storage unavailable */ } }

export function initCart({ lockScroll, unlockScroll }) {
  let qty = load();
  const drawer = $('#drawer'), scrim = $('#scrim');
  const countEl = $('#cartCount');
  const toastEl = $('#toast');
  let toastTimer;

  const shipping = () => STORE.shippingFee;
  const subtotal = () => qty * P.price;

  function toast(html) {
    toastEl.innerHTML = html;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2800);
    toastEl.querySelector('button')?.addEventListener('click', () => { toastEl.classList.remove('is-visible'); openDrawer(); });
  }

  function render() {
    save(qty);
    countEl.textContent = qty;
    countEl.classList.toggle('has-items', qty > 0);
    const body = $('#cartBody');
    $('#cartFoot').style.display = qty ? '' : 'none';
    if (!qty) {
      body.innerHTML = `<div class="empty"><div class="empty__icon">✦</div><h4>Your cart is empty</h4><p>The legend is still waiting on the wall.</p><button class="btn btn--dark" data-add-to-cart><span>Add the Warrior Sword</span></button></div>`;
    } else {
      body.innerHTML = `
        <div class="citem">
          <img src="${P.image}" alt="" />
          <div>
            <h4>${P.name}</h4>
            <small>With walnut wall plaque · ${fmt(P.price)}</small>
            <div class="citem__row">
              <div class="qty" aria-label="Quantity">
                <button data-cart-qty="-1" aria-label="Decrease">−</button><output>${qty}</output><button data-cart-qty="1" aria-label="Increase">+</button>
              </div>
              <b>${fmt(subtotal())}</b>
            </div>
            <button class="citem__remove" data-cart-remove>Remove</button>
          </div>
        </div>`;
    }
    $('#cartSubtotal').textContent = fmt(subtotal());
    $('#cartShipping').textContent = shipping() ? fmt(shipping()) : 'Free';
  }

  function add(n = 1, silent = false) {
    const before = qty;
    qty = Math.min(P.maxQty, qty + n);
    render();
    countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
    if (!silent) {
      if (qty === before) toast(`Maximum ${P.maxQty} per order`);
      else toast(`Added to cart <button>View cart</button>`);
    }
  }

  function openDrawer() { drawer.classList.add('is-open'); scrim.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); lockScroll(); }
  function closeDrawer() { drawer.classList.remove('is-open'); scrim.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); unlockScroll(); }

  // Open WhatsApp with the order details typed out for the customer.
  function orderOnWhatsApp(n) {
    const count = Math.max(1, Math.min(P.maxQty, n));
    const total = count * P.price + shipping();
    const msg = [
      `Hi! I'd like to buy ${P.name}.`,
      '',
      `• Product: ${P.name} (${P.subtitle})`,
      `• Quantity: ${count}`,
      `• Price: ${fmt(P.price)} each`,
      `• Total: ${fmt(total)}${shipping() ? ` (incl. ${fmt(shipping())} shipping)` : ' (free delivery)'}`,
      '',
      'Please share the next steps for payment and delivery.',
    ].join('\n');
    const url = `https://wa.me/${STORE.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    closeDrawer();
    const win = window.open(url, '_blank');
    if (win) win.opener = null;
    else window.location.href = url; // popup blocked → same tab
  }

  // delegated events
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.matches('[data-add-to-cart]')) { e.preventDefault(); add(1); }
    else if (t.matches('[data-cart-qty]')) { qty = Math.max(0, Math.min(P.maxQty, qty + Number(t.dataset.cartQty))); render(); }
    else if (t.matches('[data-cart-remove]')) { qty = 0; render(); }
    else if (t.matches('[data-close-drawer]')) closeDrawer();
  });
  $('#cartBtn').addEventListener('click', openDrawer);
  scrim.addEventListener('click', closeDrawer);
  $('#checkoutBtn').addEventListener('click', () => orderOnWhatsApp(qty));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
  });

  // product section quantity + buttons
  let pickQty = 1;
  const qtyVal = $('#qtyVal');
  document.querySelectorAll('[data-qty]').forEach((b) => b.addEventListener('click', () => {
    pickQty = Math.max(1, Math.min(P.maxQty, pickQty + Number(b.dataset.qty)));
    qtyVal.textContent = pickQty;
  }));
  $('#addBtn').addEventListener('click', () => add(pickQty));
  $('#buyNowBtn').addEventListener('click', () => orderOnWhatsApp(pickQty));

  render();
  return { add, openDrawer };
}
