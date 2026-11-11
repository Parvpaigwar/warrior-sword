// Cart drawer, checkout modal and order confirmation.
import { STORE, fmt } from './config.js';

const KEY = 'warrior-cart-v1';
const P = STORE.product;
const $ = (s, r = document) => r.querySelector(s);

const STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand',
  'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

function load() {
  try { const q = JSON.parse(localStorage.getItem(KEY))?.qty; return Number.isInteger(q) ? Math.max(0, Math.min(P.maxQty, q)) : 0; }
  catch { return 0; }
}
function save(qty) { try { localStorage.setItem(KEY, JSON.stringify({ qty })); } catch { /* storage unavailable */ } }

export function initCart({ lockScroll, unlockScroll }) {
  let qty = load();
  const drawer = $('#drawer'), scrim = $('#scrim'), modal = $('#checkout');
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
    // checkout summary
    $('#summaryItems').innerHTML = `<div class="sitem"><img src="${P.image}" alt="" /><div><b>${P.name}</b><small>Qty ${qty}</small></div><span>${fmt(subtotal())}</span></div>`;
    $('#sumSubtotal').textContent = fmt(subtotal());
    $('#sumShipping').textContent = shipping() ? fmt(shipping()) : 'Free';
    $('#sumTotal').textContent = fmt(subtotal() + (qty ? shipping() : 0));
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

  function openCheckout() {
    if (!qty) add(1, true);
    closeDrawer();
    $('#checkoutForm').hidden = false;
    $('#success').hidden = true;
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); lockScroll();
    setTimeout(() => modal.querySelector('input')?.focus({ preventScroll: true }), 350);
  }
  function closeCheckout() { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); unlockScroll(); }

  // state options
  const sel = $('#stateSelect');
  STATES.forEach((s) => sel.insertAdjacentHTML('beforeend', `<option>${s}</option>`));

  // delegated events
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.matches('[data-add-to-cart]')) { e.preventDefault(); add(1); }
    else if (t.matches('[data-cart-qty]')) { qty = Math.max(0, Math.min(P.maxQty, qty + Number(t.dataset.cartQty))); render(); }
    else if (t.matches('[data-cart-remove]')) { qty = 0; render(); }
    else if (t.matches('[data-close-drawer]')) closeDrawer();
    else if (t.matches('[data-close-modal]')) closeCheckout();
  });
  $('#cartBtn').addEventListener('click', openDrawer);
  scrim.addEventListener('click', closeDrawer);
  $('#checkoutBtn').addEventListener('click', openCheckout);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeCheckout(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modal.classList.contains('is-open')) closeCheckout();
    else if (drawer.classList.contains('is-open')) closeDrawer();
  });

  // product section quantity + buttons
  let pickQty = 1;
  const qtyVal = $('#qtyVal');
  document.querySelectorAll('[data-qty]').forEach((b) => b.addEventListener('click', () => {
    pickQty = Math.max(1, Math.min(P.maxQty, pickQty + Number(b.dataset.qty)));
    qtyVal.textContent = pickQty;
  }));
  $('#addBtn').addEventListener('click', () => add(pickQty));
  $('#buyNowBtn').addEventListener('click', () => {
    qty = Math.min(P.maxQty, Math.max(qty, pickQty));
    render();
    openCheckout();
  });

  // checkout validation + submit
  const form = $('#orderForm');
  form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('is-invalid'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#formError');
    let firstBad = null;
    form.querySelectorAll('input, select').forEach((el) => {
      if (el.type === 'radio') return;
      el.value = el.value.trim();
      const ok = el.checkValidity();
      el.closest('.field')?.classList.toggle('is-invalid', !ok);
      if (!ok && !firstBad) firstBad = el;
    });
    if (firstBad) {
      err.textContent = firstBad.name === 'phone' ? 'Please enter a valid 10-digit mobile number.'
        : firstBad.name === 'pin' ? 'Please enter a valid 6-digit PIN code.'
        : 'Please fill in the highlighted fields.';
      firstBad.focus();
      return;
    }
    err.textContent = '';
    const d = Object.fromEntries(new FormData(form));
    const id = 'WS-' + Date.now().toString(36).toUpperCase().slice(-6);
    const total = subtotal() + shipping();
    const order = { id, ...d, qty, total, createdAt: new Date().toISOString() };
    try {
      const all = JSON.parse(localStorage.getItem('warrior-orders') || '[]');
      all.push(order);
      localStorage.setItem('warrior-orders', JSON.stringify(all));
    } catch { /* ignore */ }

    $('#orderId').textContent = id;
    $('#orderPhone').textContent = d.phone;
    const wa = $('#waLink');
    if (STORE.whatsappNumber) {
      const msg = [`New order ${id}`, `${P.name} × ${qty} = ${fmt(total)}`, `Payment: ${d.payment}`, '',
        d.name, d.phone, d.email, d.address, `${d.city}, ${d.state} - ${d.pin}`].filter((l) => l !== undefined).join('\n');
      wa.href = `https://wa.me/${STORE.whatsappNumber}?text=${encodeURIComponent(msg)}`;
      wa.hidden = false;
    } else wa.hidden = true;

    $('#checkoutForm').hidden = true;
    $('#success').hidden = false;
    modal.querySelector('.modal__panel').scrollTop = 0;
    qty = 0;
    render();
    form.reset();
  });

  render();
  return { add, openDrawer };
}
