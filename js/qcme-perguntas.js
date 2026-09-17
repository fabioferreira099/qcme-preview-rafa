/* QCME · Perguntas na tela do plano + nota de utilidade pós-download.
   Usado pelas DUAS calculadoras (social e corporativa). Gatilhos no topo. */
(function () {
  var CFG = {
    MIN_SEG: 25,      // segundos na tela do plano (mediana de permanência no celular é 71s)
    MIN_ROLAGEM: 500, // px rolados: prova que a pessoa olhou o plano
    IDLE_MS: 1300,    // rolagem parada há X ms: nunca abre no meio do movimento
    AJUSTES: 3        // atalho: 3 ajustes de slider já na tela do plano
  };
  var ph = function (ev, props) { if (window.posthog && posthog.capture) posthog.capture(ev, props || {}); };
  var $ = function (id) { return document.getElementById(id); };
  function noResultado() { var r = $('step-resultado'); return !!(r && r.classList.contains('active')); }
  function jaBaixou() { var s = $('email-gate-success'); return !!(s && s.classList.contains('show')); }

  /* ---------- CSS ---------- */
  var css = document.createElement('style');
  css.textContent = '\
.qp-wrap{position:fixed;inset:0;z-index:9999;display:none;align-items:flex-end;justify-content:center;background:rgba(28,28,26,.45);backdrop-filter:blur(2px)}\
.qp-wrap.on{display:flex}\
.qp{background:#fff;width:100%;max-width:520px;border-radius:18px 18px 0 0;padding:20px 20px 24px;box-shadow:0 -8px 40px rgba(0,0,0,.2);animation:qpup .25s ease-out;font-family:inherit}\
@media(min-width:640px){.qp-wrap{align-items:center}.qp{border-radius:18px}}\
@keyframes qpup{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}\
.qp h3{margin:0 0 4px;font-size:1.12rem}\
.qp .qp-sub{color:#6f675d;font-size:.86rem;margin:0 0 14px}\
.qp .qp-val{background:#F7F5F1;border-radius:10px;padding:10px 12px;margin:0 0 14px;font-size:.9rem}\
.qp .qp-val b{font-size:1.15rem}\
.qp label{display:block;font-size:.82rem;color:#3a352e;margin:10px 0 5px;font-weight:600}\
.qp label span{font-weight:400;color:#a49c90}\
.qp input,.qp textarea{width:100%;padding:11px 13px;border:1px solid #ddd8d0;border-radius:10px;font-size:.95rem;font-family:inherit;box-sizing:border-box}\
.qp textarea{min-height:70px;resize:vertical}\
.qp .qp-opt{display:flex;gap:7px;flex-wrap:wrap}\
.qp .qp-opt button{flex:1;min-width:96px;padding:10px 8px;border:1px solid #ddd8d0;background:#fff;border-radius:10px;font-size:.83rem;cursor:pointer;font-family:inherit}\
.qp .qp-opt button.sel{border-color:#141210;background:#141210;color:#fff}\
.qp .qp-go{width:100%;margin-top:16px;padding:14px;border:0;border-radius:10px;background:#4CB748;color:#fff;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit}\
.qp .qp-go.dark{background:#141210}\
.qp .qp-skip{display:block;width:100%;margin-top:10px;background:none;border:0;color:#6f675d;font-size:.83rem;text-decoration:underline;cursor:pointer;font-family:inherit}\
.qp .qp-op{font-size:.75rem;color:#a49c90;margin:8px 0 0;text-align:center}\
.qp .qp-esc{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px}\
.qp .qp-esc button{flex:1;min-width:36px;padding:11px 0;border:1px solid #ddd8d0;background:#fff;border-radius:8px;font-size:.9rem;cursor:pointer;font-family:inherit;font-weight:600}\
.qp .qp-esc button.sel{background:#141210;color:#fff;border-color:#141210}\
.qp .qp-leg{display:flex;justify-content:space-between;font-size:.72rem;color:#a49c90;margin-bottom:4px}';
  document.head.appendChild(css);

  /* ---------- POPUP: baixar + 2 perguntas ---------- */
  var pop = document.createElement('div');
  pop.className = 'qp-wrap'; pop.id = 'qp-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-modal', 'true');
  pop.innerHTML = '\
<div class="qp">\
 <h3 class="serif">Leve seu plano completo</h3>\
 <p class="qp-sub">O plano detalhado por categoria, pronto pra usar no seu planejamento.</p>\
 <div class="qp-val">Seu plano hoje: <b id="qp-total">—</b></div>\
 <form id="qp-form">\
  <input type="text" name="nome" placeholder="Seu nome" required>\
  <div style="height:8px"></div>\
  <input type="email" name="email" placeholder="Seu e-mail" required>\
  <label>Quando é o evento? <span>(opcional)</span></label>\
  <input type="month" name="data_evento">\
  <label>Você já tem o espaço reservado? <span>(opcional)</span></label>\
  <div class="qp-opt" id="qp-esp">\
   <button type="button" data-v="Já tenho">Já tenho</button>\
   <button type="button" data-v="Estou visitando">Estou visitando</button>\
   <button type="button" data-v="Ainda não comecei">Ainda não comecei</button>\
  </div>\
  <button type="submit" class="qp-go">Baixar plano completo</button>\
  <button type="button" class="qp-skip" id="qp-x">Agora não, quero continuar ajustando</button>\
  <p class="qp-op">As duas perguntas são opcionais. O plano baixa do mesmo jeito.</p>\
 </form>\
</div>';
  document.body.appendChild(pop);

  var mostrado = false, ajustes = 0, espaco = '', seg = 0, rolou = 0, ultimoScroll = 0, y0 = window.scrollY;
  var emailLead = '';
  var NOTA_ENDPOINT = '/quantocustameuevento/api/ac-nota';
  (function(){ var rf = $('email-gate-form'); if (rf) rf.addEventListener('submit', function () {
    var el = rf.querySelector('[name="email"]'); if (el && el.value) emailLead = el.value.trim().toLowerCase();
  }, true); })();
  function enviarNota(n, c) {
    if (!emailLead) return;
    try { fetch(NOTA_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailLead, nota: n, comentario: c || '' }), keepalive: true }).catch(function(){}); } catch (e) {}
  }
  function podeAbrir() {
    if (mostrado || !noResultado() || jaBaixou()) return false;
    if (seg < CFG.MIN_SEG) return false;
    if (rolou < CFG.MIN_ROLAGEM && ajustes < CFG.AJUSTES) return false;
    if (Date.now() - ultimoScroll < CFG.IDLE_MS) return false;
    return true;
  }
  function abrir(motivo) {
    if (mostrado) return;
    mostrado = true;
    var t = $('total-display'); $('qp-total').textContent = t ? t.textContent : '—';
    pop.classList.add('on');
    ph('popup_plano_aberto', { gatilho: motivo, segundos: seg, rolagem_px: rolou, ajustes: ajustes });
  }
  window.addEventListener('scroll', function () {
    if (!noResultado()) return;
    rolou += Math.abs(window.scrollY - y0); y0 = window.scrollY; ultimoScroll = Date.now();
  }, { passive: true });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.type === 'range' && noResultado()) ajustes++;
  }, true);
  setInterval(function () {
    if (!noResultado()) { seg = 0; rolou = 0; return; }
    seg++;
    if (podeAbrir()) abrir(ajustes >= CFG.AJUSTES ? 'ajustes' : 'leu');
  }, 1000);

  $('qp-x').addEventListener('click', function () {
    pop.classList.remove('on'); ph('popup_plano_dispensado', { segundos: seg, rolagem_px: rolou, ajustes: ajustes });
  });
  Array.prototype.forEach.call(document.querySelectorAll('#qp-esp button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('#qp-esp button'), function (x) { x.classList.remove('sel'); });
      b.classList.add('sel'); espaco = b.dataset.v;
    });
  });
  $('qp-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = new FormData(e.target);
    var real = $('email-gate-form'); if (!real) return;
    var set = function (n, v) { var el = real.querySelector('[name="' + n + '"]'); if (el) el.value = v || ''; };
    set('nome', f.get('nome')); set('email', f.get('email'));
    set('data_evento', f.get('data_evento')); set('espaco_reservado', espaco);
    ph('popup_plano_enviado', { tem_data: !!f.get('data_evento'), espaco: espaco || '(não respondeu)' });
    pop.classList.remove('on');
    if (real.requestSubmit) real.requestSubmit(); else { var b = real.querySelector('button[type=submit]'); if (b) b.click(); }
  });

  /* ---------- NOTA DE UTILIDADE: depois do download ---------- */
  var nt = document.createElement('div');
  nt.className = 'qp-wrap'; nt.id = 'qp-nota'; nt.setAttribute('role', 'dialog'); nt.setAttribute('aria-modal', 'true');
  nt.innerHTML = '\
<div class="qp">\
 <div id="qn-p1">\
  <h3 class="serif">De 0 a 10, o quanto essa calculadora te ajudou a planejar?</h3>\
  <p class="qp-sub">Leva 5 segundos e ajuda a gente a melhorar a ferramenta.</p>\
  <div class="qp-leg"><span>Não ajudou</span><span>Ajudou muito</span></div>\
  <div class="qp-esc" id="qn-esc"></div>\
  <button type="button" class="qp-skip" id="qn-x1">Agora não</button>\
 </div>\
 <div id="qn-p2" style="display:none">\
  <h3 class="serif" id="qn-q2"></h3>\
  <p class="qp-sub">Opcional, mas é o que mais ajuda.</p>\
  <textarea id="qn-txt" placeholder="Escreve do seu jeito..."></textarea>\
  <button type="button" class="qp-go dark" id="qn-env">Enviar</button>\
  <button type="button" class="qp-skip" id="qn-x2">Pular</button>\
 </div>\
 <div id="qn-p3" style="display:none">\
  <h3 class="serif">Valeu!</h3>\
  <p class="qp-sub">A gente lê tudo. Obrigado por ajudar a melhorar.</p>\
 </div>\
</div>';
  document.body.appendChild(nt);
  var nota = null, notaAberta = false, esc = $('qn-esc');
  for (var i = 0; i <= 10; i++) (function (n) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = n;
    b.addEventListener('click', function () {
      nota = n;
      Array.prototype.forEach.call(esc.children, function (x) { x.classList.remove('sel'); });
      b.classList.add('sel');
      ph('utilidade_nota', { nota: n });
      enviarNota(n, '');
      $('qn-q2').textContent = n <= 6 ? 'O que faltou pra ela te ajudar mais?' : (n <= 8 ? 'O que faria ela virar um 10?' : 'O que mais te ajudou?');
      setTimeout(function () { $('qn-p1').style.display = 'none'; $('qn-p2').style.display = 'block'; }, 260);
    });
    esc.appendChild(b);
  })(i);
  function fecharNota() { nt.classList.remove('on'); }
  $('qn-x1').addEventListener('click', function () { ph('utilidade_dispensada', {}); fecharNota(); });
  $('qn-x2').addEventListener('click', function () { ph('utilidade_comentario', { nota: nota, tem_texto: false }); fecharNota(); });
  $('qn-env').addEventListener('click', function () {
    var t = ($('qn-txt').value || '').trim();
    ph('utilidade_comentario', { nota: nota, tem_texto: !!t, comentario: t.slice(0, 500) });
    if (t) enviarNota(nota, t);
    $('qn-p2').style.display = 'none'; $('qn-p3').style.display = 'block';
    setTimeout(fecharNota, 1800);
  });
  var alvo = $('email-gate-success');
  if (alvo && window.MutationObserver) {
    new MutationObserver(function () {
      if (!notaAberta && alvo.classList.contains('show')) {
        notaAberta = true; pop.classList.remove('on');
        setTimeout(function () { nt.classList.add('on'); ph('utilidade_aberta', {}); }, 700);
      }
    }).observe(alvo, { attributes: true, attributeFilter: ['class'] });
  }
})();
