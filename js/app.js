/* ============================================================
   QCME — Quanto Custa Meu Evento
   Config central, analytics e UTM.
   ============================================================ */

/* ---------- CONFIG (preencher antes do go-live) ---------- */
const QCME = {
  GA4_ID: '',            // TODO: ex. 'G-XXXXXXXXXX'
  // Sem barra no início: relativo à página atual, não à raiz do domínio — precisa funcionar
  // tanto direto no Vercel (calculadora.html) quanto atrás do proxy exc.rio.br/quantocustameuevento/
  // (barra no início quebrava ali: virava exc.rio.br/api/ac-sync, que não existe).
  FORM_ENDPOINT: '', // preview público: não envia dados
  VERSAO: 'social',      // vai em todo evento; o GTM separa social de corporativo por aqui
  WHATSAPP: '',          // TODO: ex. '5521999999999' (só números, com DDI)
  CONTATO_URL: 'https://exc.rio.br/#contato',  // fallback se WHATSAPP vazio
};
const EXCCO = QCME; // compatibilidade

function contatoURL() {
  if (QCME.WHATSAPP) {
    const msg = encodeURIComponent('Olá! Montei um plano no Quanto Custa Meu Evento e quero falar com um especialista.');
    return 'https://wa.me/' + QCME.WHATSAPP + '?text=' + msg;
  }
  return QCME.CONTATO_URL;
}

/* ---------- ANALYTICS ---------- */
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
if (QCME.GA4_ID) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + QCME.GA4_ID;
  document.head.appendChild(s);
  gtag('js', new Date());
  gtag('config', QCME.GA4_ID);
}
function track(eventName, params) {
  const payload = Object.assign({ page: location.pathname }, params || {});
  gtag('event', eventName, payload);
  if (window.posthog) posthog.capture(eventName, payload);
  if (!QCME.GA4_ID) console.log('[analytics]', eventName, payload);
}

/* ---------- UTM ---------- */
(function captureUTM() {
  const qs = new URLSearchParams(location.search);
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
  keys.forEach(k => {
    const v = qs.get(k);
    if (v) sessionStorage.setItem('qcme_' + k, v);
  });
})();
function getUTMs() {
  const out = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'].forEach(k => {
    const v = sessionStorage.getItem('qcme_' + k);
    if (v) out[k] = v;
  });
  return out;
}

/* ---------- Modal "Falar com um especialista" ----------
   Substitui o link direto pro form do site principal (fora do nosso controle)
   por um formulário embutido: captura nome/email/whatsapp (pré-preenche
   nome/email se a pessoa já passou pelo email-gate), leva o contexto do
   plano já montado (se a página expuser window.QCME_getPlanContext), e
   dispara um evento próprio no dataLayer — sem navegar pra fora da LP. */
(function contatoModal() {
  function normPhone(v) {
    const d = (v || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length >= 12 && d.slice(0, 2) === '55') return d;
    if (d.length === 10 || d.length === 11) return '55' + d;
    return d;
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim()); }

  function buildModal() {
    const ov = document.createElement('div');
    ov.className = 'qcme-modal-overlay';
    ov.id = 'qcme-contato-overlay';
    ov.innerHTML =
      '<div class="qcme-modal" role="dialog" aria-modal="true" aria-labelledby="qcme-modal-title">' +
        '<button type="button" class="qcme-modal-close" aria-label="Fechar">&times;</button>' +
        '<h3 id="qcme-modal-title">Falar com um especialista</h3>' +
        '<p>Deixe seu contato: um especialista em eventos do Exc te chama com o plano em mãos.</p>' +
        '<form class="qcme-modal-form" id="qcme-contato-form">' +
          '<input type="text" name="nome" placeholder="Seu nome" required>' +
          '<input type="email" name="email" placeholder="Seu e-mail" required>' +
          '<input type="tel" name="whatsapp" placeholder="Seu WhatsApp (com DDD)" required>' +
          '<label class="qcme-modal-label" for="qcme-data-evento">Data prevista do evento (opcional)</label>' +
          '<input type="month" name="data_evento" id="qcme-data-evento">' +
          '<p class="qcme-modal-error" id="qcme-modal-error"></p>' +
          '<button type="submit" class="btn-verde">Quero falar com um especialista</button>' +
        '</form>' +
        '<div class="qcme-modal-success" id="qcme-modal-success">' +
          '<div class="qcme-modal-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2FA35C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="#E8F1E8" stroke="none"/><path d="M7 12.5l3.2 3.2L17 9"/></svg></div>' +
          '<p style="margin:0"><strong>Contato recebido!</strong><br>Alguém do time do Exc te chama pelo WhatsApp com o plano em mãos.</p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    return ov;
  }

  function openModal(ov) {
    ov.classList.add('is-open');
    const stored = { nome: sessionStorage.getItem('qcme_nome') || '', email: sessionStorage.getItem('qcme_email') || '' };
    const form = ov.querySelector('#qcme-contato-form');
    if (stored.nome) form.nome.value = stored.nome;
    if (stored.email) form.email.value = stored.email;
    form.style.display = '';
    ov.querySelector('#qcme-modal-success').classList.remove('is-visible');
    ov.querySelector('#qcme-modal-error').classList.remove('is-visible');
  }
  function closeModal(ov) { ov.classList.remove('is-open'); }

  document.addEventListener('DOMContentLoaded', () => {
    const ov = buildModal();
    const errEl = ov.querySelector('#qcme-modal-error');
    const form = ov.querySelector('#qcme-contato-form');
    const successEl = ov.querySelector('#qcme-modal-success');

    // delegado no document (não só nos [data-contato] que já existem no load): o botão
    // "Falar com especialista" do resultado (#venue-cta) é criado depois, quando a pessoa
    // termina o plano — sem delegação ele escapava do modal e navegava direto pro href.
    document.querySelectorAll('[data-contato]').forEach(a => { a.href = contatoURL(); }); // fallback se JS falhar
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-contato]');
      if (!a) return;
      e.preventDefault();
      openModal(ov);
    });
    ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(ov); });
    ov.querySelector('.qcme-modal-close').addEventListener('click', () => closeModal(ov));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const whatsapp = normPhone(data.whatsapp);
      if (!validEmail(data.email)) { errEl.textContent = 'Digite um e-mail válido.'; errEl.classList.add('is-visible'); return; }
      if (whatsapp.length < 12) { errEl.textContent = 'Digite um WhatsApp válido, com DDD.'; errEl.classList.add('is-visible'); return; }
      errEl.classList.remove('is-visible');

      sessionStorage.setItem('qcme_nome', data.nome.trim());
      sessionStorage.setItem('qcme_email', data.email.trim().toLowerCase());
      if (window.posthog) posthog.identify(data.email.trim().toLowerCase(), { name: data.nome.trim() });

      const planCtx = (typeof window.QCME_getPlanContext === 'function') ? (window.QCME_getPlanContext() || {}) : {};
      const lead = Object.assign({
        nome: data.nome.trim(),
        email: data.email.trim().toLowerCase(),
        whatsapp_e164: whatsapp,
        fonte: 'calculadora_qcme_especialista',
        data_evento: data.data_evento || '',
        url_origem: location.href,
        segmento: planCtx.tipo === 'Corporativo' ? 'Corporativo' : (planCtx.tipo ? 'Social' : ''),
      }, planCtx, getUTMs());

      track('falar_especialista', { tipo: planCtx.tipo || '', orcamento: planCtx.orcamento || '' });
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'calc_falar_especialista', versao: QCME.VERSAO, lead: lead });

      if (QCME.FORM_ENDPOINT) {
        try { await fetch(QCME.FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }); }
        catch (err) { console.error('[especialista] falha ao sincronizar com o CRM; lead:', lead, err); }
      }

      form.style.display = 'none';
      successEl.classList.add('is-visible');
    });
  });
})();
