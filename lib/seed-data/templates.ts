/**
 * 20 layout templates for MVP.
 * All templates include real HTML/CSS.
 * First 8: imported from brand-builder (web-design-and-development).
 * Remaining 12: built-in variants (single-hero-cta, stats-bar, pricing-cards, etc.).
 */

export interface TemplateSeed {
  name: string;
  description: string;
  category: string;
  htmlTemplate: string;
  cssTemplate: string;
  suitableIndustries: string[];
}

// --- Brand-builder templates (real HTML/CSS from custom-section-feature-templates) ---

const DUAL_HERO_HTML = `<div class="split-hero">
  <div class="split-hero-text">
    <h1>{{headline}}</h1>
    <p>{{subheadline}}</p>
    <a href="/your-cta-page" class="split-hero-btn">{{ctaText}}</a>
  </div>
  <div class="split-hero-demo">
    <div class="device-frame">
      <div class="device-frame-header">
        <span class="frame-dot"></span>
        <span class="frame-dot"></span>
        <span class="frame-dot"></span>
      </div>
      <div class="demo-wrapper">
        <img src="YOUR_SCREENSHOT_URL" alt="Product Screenshot" style="width:100%;height:100%;object-fit:cover;">
      </div>
    </div>
  </div>
</div>`;

const DUAL_HERO_CSS = `.split-hero {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 40px;
  align-items: start;
  padding: 60px 40px;
  max-width: 1400px;
  margin: 0 auto;
}
.split-hero-text {
  max-width: 480px;
  margin-left: auto;
  padding-top: 40px;
}
.split-hero-text h1 {
  font-size: 2.8em;
  line-height: 1.15;
  color: var(--primary-color, #00356B);
  margin-bottom: 20px;
}
.split-hero-text p {
  font-size: 1.15em;
  line-height: 1.7;
  color: var(--text-color, #1D231C);
  opacity: 0.85;
  margin-bottom: 30px;
}
.split-hero-btn {
  display: inline-block;
  background: var(--primary-color, #00356B);
  color: #fff !important;
  padding: 16px 32px;
  border-radius: 6px;
  font-size: 1em;
  font-weight: 600;
  text-decoration: none !important;
  transition: all 0.3s ease;
  box-shadow: 0 4px 14px rgba(0, 53, 107, 0.25);
}
.split-hero-btn:hover {
  background: var(--secondary-color, #1D231C);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 53, 107, 0.3);
}
.split-hero-demo { flex-shrink: 0; }
.device-frame {
  background: #1D231C;
  border-radius: 12px;
  padding: 0;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  width: 800px;
}
.device-frame-header {
  background: #2a2f2a;
  padding: 8px 12px;
  display: flex;
  gap: 6px;
}
.frame-dot { width: 10px; height: 10px; border-radius: 50%; }
.frame-dot:nth-child(1) { background: #ff5f57; }
.frame-dot:nth-child(2) { background: #febc2e; }
.frame-dot:nth-child(3) { background: #28c840; }
.demo-wrapper {
  width: 800px;
  height: 520px;
  background: #fff;
}
.demo-wrapper img { width: 100%; height: 100%; border: none; }
@media screen and (max-width: 1200px) {
  .split-hero { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .split-hero-text { margin-left: 0; max-width: 600px; }
  .split-hero-demo { max-width: 100%; overflow-x: auto; }
}
@media screen and (max-width: 767px) {
  .split-hero { padding: 40px 20px; }
  .split-hero-text h1 { font-size: 1.9em; }
  .split-hero-text p { font-size: 1em; }
}`;

const LOGO_MARQUEE_HTML = `<div class="logo-marquee-section">
  <div class="logo-marquee-track">
    <div class="logo-item"><img src="YOUR_LOGO_1_URL" alt="Partner 1"></div>
    <div class="logo-item"><img src="YOUR_LOGO_2_URL" alt="Partner 2"></div>
    <div class="logo-item"><img src="YOUR_LOGO_3_URL" alt="Partner 3"></div>
    <div class="logo-item"><img src="YOUR_LOGO_4_URL" alt="Partner 4"></div>
    <div class="logo-item"><img src="YOUR_LOGO_5_URL" alt="Partner 5"></div>
    <div class="logo-item"><img src="YOUR_LOGO_6_URL" alt="Partner 6"></div>
    <div class="logo-item"><img src="YOUR_LOGO_1_URL" alt="Partner 1"></div>
    <div class="logo-item"><img src="YOUR_LOGO_2_URL" alt="Partner 2"></div>
    <div class="logo-item"><img src="YOUR_LOGO_3_URL" alt="Partner 3"></div>
    <div class="logo-item"><img src="YOUR_LOGO_4_URL" alt="Partner 4"></div>
    <div class="logo-item"><img src="YOUR_LOGO_5_URL" alt="Partner 5"></div>
    <div class="logo-item"><img src="YOUR_LOGO_6_URL" alt="Partner 6"></div>
  </div>
</div>`;

const LOGO_MARQUEE_CSS = `.logo-marquee-section {
  padding: 40px 0;
  background: #fff;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--border-color, #E1DFD9);
  border-radius: 16px;
  margin: 20px 40px;
}
.logo-marquee-section::before, .logo-marquee-section::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  width: 120px;
  z-index: 2;
  pointer-events: none;
}
.logo-marquee-section::before {
  left: 0;
  background: linear-gradient(to right, #fff 0%, transparent 100%);
  border-radius: 16px 0 0 16px;
}
.logo-marquee-section::after {
  right: 0;
  background: linear-gradient(to left, #fff 0%, transparent 100%);
  border-radius: 0 16px 16px 0;
}
.logo-marquee-track {
  display: flex;
  align-items: center;
  gap: 80px;
  animation: logoScroll 30s linear infinite;
  width: max-content;
}
@keyframes logoScroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.logo-item { flex-shrink: 0; }
.logo-item img {
  height: 55px;
  width: auto;
  max-width: 150px;
  object-fit: contain;
  opacity: 0.7;
  filter: grayscale(100%);
  transition: all 0.3s ease;
}
.logo-item img:hover {
  opacity: 1;
  filter: grayscale(0%);
}
@media screen and (max-width: 767px) {
  .logo-marquee-section { padding: 30px 0; margin: 15px; border-radius: 12px; }
  .logo-marquee-track { gap: 50px; }
  .logo-item img { height: 45px; }
}`;

const IOS_CARD_FAN_HTML = `<div class="use-cases-section">
  <div class="use-cases-header">
    <h2>{{sectionHeadline}}</h2>
    <p>{{sectionSubheadline}}</p>
  </div>
  <div class="use-cases-container">
    <div class="card-stack">
      <div class="stack-card card-0" data-index="0" data-title="{{feature1_title}}" data-description="{{feature1_body}}" style="background-image:url('YOUR_SCREENSHOT_1_URL');"></div>
      <div class="stack-card card-1" data-index="1" data-title="{{feature2_title}}" data-description="{{feature2_body}}" style="background-image:url('YOUR_SCREENSHOT_2_URL');"></div>
      <div class="stack-card card-2 active" data-index="2" data-title="{{feature3_title}}" data-description="{{feature3_body}}" style="background-image:url('YOUR_SCREENSHOT_3_URL');"></div>
      <div class="stack-card card-3" data-index="3" data-title="{{feature4_title}}" data-description="{{feature4_body}}" style="background-image:url('YOUR_SCREENSHOT_4_URL');"></div>
      <div class="stack-card card-4" data-index="4" data-title="{{feature5_title}}" data-description="{{feature5_body}}" style="background-image:url('YOUR_SCREENSHOT_5_URL');"></div>
    </div>
    <div class="info-panel-wrapper">
      <div class="info-panel visible">
        <h3 id="panelTitle">{{feature3_title}}</h3>
        <p id="panelDescription">{{feature3_body}}</p>
        <a href="/your-cta-link" class="info-panel-cta">{{ctaText}}</a>
      </div>
      <div class="card-dots">
        <button class="card-dot" data-index="0" aria-label="View Use Case 1"></button>
        <button class="card-dot" data-index="1" aria-label="View Use Case 2"></button>
        <button class="card-dot active" data-index="2" aria-label="View Use Case 3"></button>
        <button class="card-dot" data-index="3" aria-label="View Use Case 4"></button>
        <button class="card-dot" data-index="4" aria-label="View Use Case 5"></button>
      </div>
    </div>
  </div>
</div>
<script>
(function() {
  var cards = document.querySelectorAll('.stack-card');
  var dots = document.querySelectorAll('.card-dot');
  var panel = document.querySelector('.info-panel');
  var panelTitle = document.getElementById('panelTitle');
  var panelDesc = document.getElementById('panelDescription');
  function selectCard(index) {
    var targetCard = document.querySelector('.stack-card[data-index="' + index + '"]');
    if (!targetCard) return;
    cards.forEach(function(c) { c.classList.remove('active'); });
    dots.forEach(function(d) { d.classList.remove('active'); });
    targetCard.classList.add('active');
    var dot = document.querySelector('.card-dot[data-index="' + index + '"]');
    if (dot) dot.classList.add('active');
    panel.classList.remove('visible');
    setTimeout(function() {
      panelTitle.textContent = targetCard.getAttribute('data-title');
      panelDesc.textContent = targetCard.getAttribute('data-description');
      panel.classList.add('visible');
    }, 200);
  }
  cards.forEach(function(card) {
    card.addEventListener('click', function() { selectCard(this.getAttribute('data-index')); });
  });
  dots.forEach(function(dot) {
    dot.addEventListener('click', function() { selectCard(this.getAttribute('data-index')); });
  });
})();
</script>`;

const IOS_CARD_FAN_CSS = `.use-cases-section {
  padding: 80px 40px 100px;
  background: var(--section-bg, #f8f7f5);
  border-radius: 24px;
  margin: 20px 40px;
}
.use-cases-header { text-align: center; margin-bottom: 50px; }
.use-cases-header h2 { font-size: 2.4em; color: var(--primary-color, #00356B); margin-bottom: 12px; }
.use-cases-header p { font-size: 1.15em; color: var(--text-color, #1D231C); opacity: 0.7; }
.use-cases-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 100px;
  max-width: 1100px;
  margin: 0 auto;
}
.card-stack { position: relative; width: 620px; height: 450px; flex-shrink: 0; }
.stack-card {
  position: absolute;
  width: 200px;
  height: 400px;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  cursor: pointer;
  transition: all 0.3s ease;
  background-size: cover;
  background-position: center top;
  opacity: 0.95;
}
.stack-card:hover { opacity: 1; box-shadow: 0 15px 40px rgba(0,0,0,0.25); }
.stack-card.active { opacity: 1; box-shadow: 0 20px 50px rgba(0,53,107,0.4); z-index: 20 !important; }
.card-0 { left: 0; top: 35px; transform: rotate(-12deg); z-index: 1; }
.card-1 { left: 105px; top: 10px; transform: rotate(-6deg); z-index: 2; }
.card-2 { left: 210px; top: 0; transform: rotate(0deg); z-index: 3; }
.card-3 { left: 315px; top: 10px; transform: rotate(6deg); z-index: 4; }
.card-4 { left: 420px; top: 35px; transform: rotate(12deg); z-index: 5; }
.card-0.active { transform: rotate(-12deg) scale(1.08); }
.card-1.active { transform: rotate(-6deg) scale(1.08); }
.card-2.active { transform: rotate(0deg) scale(1.08); }
.card-3.active { transform: rotate(6deg) scale(1.08); }
.card-4.active { transform: rotate(12deg) scale(1.08); }
.info-panel-wrapper { display: flex; flex-direction: column; align-items: center; gap: 25px; }
.info-panel {
  width: 280px;
  min-width: 280px;
  height: 320px;
  background: #fff;
  padding: 30px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
  border-left: 4px solid var(--accent-color, #B8860B);
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  display: flex;
  flex-direction: column;
}
.info-panel.visible { opacity: 1; transform: translateY(0); }
.info-panel h3 { font-size: 1.4em; color: var(--primary-color, #00356B); margin-bottom: 15px; flex-shrink: 0; }
.info-panel p { font-size: 1em; line-height: 1.7; color: var(--text-color, #1D231C); margin-bottom: 0; opacity: 0.85; flex-grow: 1; }
.info-panel-cta { color: var(--primary-color, #00356B) !important; font-weight: 600; text-decoration: none !important; transition: all 0.3s ease; flex-shrink: 0; margin-top: auto; padding-top: 20px; }
.info-panel-cta:hover { color: var(--accent-color, #B8860B) !important; }
.card-dots { display: flex; justify-content: center; gap: 12px; }
.card-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--primary-color, #00356B);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: all 0.3s ease;
}
.card-dot:hover { background: rgba(0, 53, 107, 0.3); }
.card-dot.active { background: var(--accent-color, #B8860B); border-color: var(--accent-color, #B8860B); }
@media screen and (max-width: 900px) {
  .use-cases-container { flex-direction: column; gap: 50px; }
  .info-panel-wrapper { width: 100%; max-width: 400px; }
  .info-panel { width: 100%; }
}
@media screen and (max-width: 767px) {
  .use-cases-section { padding: 60px 20px 80px; margin: 15px; border-radius: 20px; }
  .card-stack { width: 100%; max-width: 420px; height: 350px; }
  .stack-card { width: 140px; height: 280px; }
  .card-0 { left: 0; top: 25px; }
  .card-1 { left: 70px; top: 8px; }
  .card-2 { left: 140px; top: 0; }
  .card-3 { left: 210px; top: 8px; }
  .card-4 { left: 280px; top: 25px; }
  .use-cases-header h2 { font-size: 1.8em; }
  .info-panel { padding: 25px; height: auto; min-height: 280px; }
}`;

const DUAL_DEMO_HTML = `<div class="demo-section">
  <div class="demo-header">
    <h2>{{sectionHeadline}}</h2>
    <p>{{sectionSubheadline}}</p>
  </div>
  <div class="demo-container">
    <div class="demo-phone-showcase">
      <div class="screenshot-carousel">
        <img src="YOUR_SCREENSHOT_1_URL" alt="Product Screenshot 1" class="carousel-slide active">
        <img src="YOUR_SCREENSHOT_2_URL" alt="Product Screenshot 2" class="carousel-slide">
        <img src="YOUR_SCREENSHOT_3_URL" alt="Product Screenshot 3" class="carousel-slide">
      </div>
      <div class="carousel-dots">
        <button class="carousel-dot active" data-slide="0"></button>
        <button class="carousel-dot" data-slide="1"></button>
        <button class="carousel-dot" data-slide="2"></button>
      </div>
    </div>
    <div class="demo-scheduling-wrapper">
      <div class="demo-placeholder">{{ctaText}}</div>
    </div>
  </div>
</div>
<script>
(function() {
  var slides = document.querySelectorAll('.carousel-slide');
  var dots = document.querySelectorAll('.carousel-dot');
  var currentSlide = 0;
  var autoplayInterval;
  function showSlide(index) {
    slides.forEach(function(slide) { slide.classList.remove('active'); });
    dots.forEach(function(dot) { dot.classList.remove('active'); });
    if (slides[index]) slides[index].classList.add('active');
    if (dots[index]) dots[index].classList.add('active');
    currentSlide = index;
  }
  function nextSlide() {
    var next = (currentSlide + 1) % slides.length;
    showSlide(next);
  }
  dots.forEach(function(dot, index) {
    dot.addEventListener('click', function() { showSlide(index); });
  });
  autoplayInterval = setInterval(nextSlide, 3000);
})();
</script>`;

const DUAL_DEMO_CSS = `.demo-section {
  padding: 80px 40px 60px;
  background: var(--section-bg, #f8f7f5);
  max-width: 1400px;
  margin: 20px auto;
  border-radius: 24px;
}
.demo-header { text-align: center; margin-bottom: 40px; }
.demo-header h2 { font-size: 2.4em; color: var(--primary-color, #00356B); margin-bottom: 12px; }
.demo-header p { font-size: 1.15em; color: var(--text-color, #1D231C); opacity: 0.75; }
.demo-container {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 60px;
}
.demo-phone-showcase {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}
.screenshot-carousel { width: 280px; height: 570px; position: relative; }
.carousel-slide {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.5s ease;
}
.carousel-slide.active { opacity: 1; }
.carousel-dots { display: flex; justify-content: center; gap: 10px; }
.carousel-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  border: 2px solid var(--primary-color, #00356B);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: all 0.3s ease;
}
.carousel-dot:hover { background: rgba(0, 53, 107, 0.3); }
.carousel-dot.active { background: var(--accent-color, #B8860B); border-color: var(--accent-color, #B8860B); }
.demo-scheduling-wrapper {
  flex: 1;
  max-width: 500px;
  min-width: 320px;
}
.demo-placeholder {
  height: 400px;
  background: var(--border-color, #E1DFD9);
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color, #1D231C);
  font-size: 1.1em;
}
@media screen and (max-width: 1000px) {
  .demo-container { flex-direction: column; align-items: center; gap: 40px; }
  .demo-scheduling-wrapper { width: 100%; max-width: 500px; }
}
@media screen and (max-width: 767px) {
  .demo-section { padding: 50px 20px 40px; margin: 15px; border-radius: 20px; }
  .demo-header h2 { font-size: 1.8em; }
  .screenshot-carousel { width: 240px; height: 490px; }
}`;

const SWITCH_PROVIDER_HTML = `<div class="switch-cta-section">
  <div class="switch-cta-content">
    <div class="switch-cta-badge">{{sectionHeadline}}</div>
    <h2 class="switch-cta-headline">{{headline}}</h2>
    <div class="switch-benefits">
      <div class="switch-benefit">
        <span class="benefit-icon">🎯</span>
        <span class="benefit-text">{{benefit1}}</span>
      </div>
      <div class="switch-benefit">
        <span class="benefit-icon">📋</span>
        <span class="benefit-text">{{benefit2}}</span>
      </div>
      <div class="switch-benefit">
        <span class="benefit-icon">📱</span>
        <span class="benefit-text">{{benefit3}}</span>
      </div>
    </div>
  </div>
  <div class="switch-cta-visual">
    <div class="phone-switch-animation">
      <div class="old-phone">
        <div class="phone-screen old">
          <div class="old-solution-display">
            <span class="old-solution-text">Old Way</span>
            <span class="old-solution-label">Competitor</span>
          </div>
        </div>
      </div>
      <div class="switch-arrow-container">
        <div class="switch-arrows">
          <span>→</span>
          <span>→</span>
          <span>→</span>
        </div>
      </div>
      <div class="new-phone-image">
        <img src="YOUR_PRODUCT_SCREENSHOT_URL" alt="Your Product" class="new-solution-img">
      </div>
    </div>
    <div class="switch-cta-buttons">
      <a href="/compare" class="switch-cta-button primary">{{ctaText}} <span class="button-arrow">→</span></a>
      <a href="/get-started" class="switch-cta-button secondary">{{ctaSecondary}} <span class="button-arrow">→</span></a>
    </div>
  </div>
</div>`;

const SWITCH_PROVIDER_CSS = `.switch-cta-section {
  padding: 80px 40px;
  background: linear-gradient(135deg, var(--section-bg, #f8f7f5) 0%, var(--border-color, #E1DFD9) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 80px;
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  margin: 20px 40px;
}
.switch-cta-section::before {
  content: '';
  position: absolute;
  top: -30%; right: -5%;
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(0,53,107,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.switch-cta-content { max-width: 500px; position: relative; z-index: 1; }
.switch-cta-badge {
  display: inline-block;
  background: var(--primary-color, #00356B);
  color: #fff;
  padding: 10px 20px;
  border-radius: 25px;
  font-size: 0.85em;
  font-weight: 600;
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.switch-cta-headline { font-size: 2.4em; color: var(--text-color, #1D231C); line-height: 1.2; margin-bottom: 30px; }
.switch-cta-headline span { color: var(--primary-color, #00356B); display: block; }
.switch-benefits { display: flex; flex-direction: column; gap: 12px; }
.switch-benefit { display: flex; align-items: center; gap: 12px; color: var(--text-color, #1D231C); font-size: 1em; }
.benefit-icon { font-size: 1.2em; }
.benefit-text { opacity: 0.9; }
.switch-cta-visual { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 30px; }
.phone-switch-animation { display: flex; align-items: center; gap: 25px; }
.old-phone {
  width: 145px;
  height: 300px;
  background: #1D231C;
  border-radius: 36px;
  padding: 10px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.15);
}
.phone-screen {
  width: 100%; height: 100%;
  border-radius: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  text-align: center;
  padding: 0;
  overflow: hidden;
}
.phone-screen.old { background: linear-gradient(180deg, #666 0%, #555 100%); color: #fff; }
.old-solution-display { width: 100%; padding: 30px 15px 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); }
.old-solution-text { display: block; font-size: 1.4em; font-weight: 600; color: #fff; letter-spacing: 1px; margin-bottom: 4px; }
.old-solution-label { display: block; font-size: 0.7em; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.6); font-weight: 500; }
.new-phone-image { display: flex; align-items: center; justify-content: center; }
.new-solution-img { height: 300px; width: auto; filter: drop-shadow(0 20px 50px rgba(0,0,0,0.15)); }
.switch-arrow-container { display: flex; flex-direction: column; align-items: center; }
.switch-arrows { display: flex; gap: 5px; color: var(--accent-color, #B8860B); font-size: 1.5em; font-weight: bold; }
.switch-arrows span:nth-child(1) { animation: arrowMove 1.5s ease-in-out infinite 0s; }
.switch-arrows span:nth-child(2) { animation: arrowMove 1.5s ease-in-out infinite 0.2s; }
.switch-arrows span:nth-child(3) { animation: arrowMove 1.5s ease-in-out infinite 0.4s; }
@keyframes arrowMove {
  0%, 100% { opacity: 0.3; transform: translateX(0); }
  50% { opacity: 1; transform: translateX(5px); }
}
.switch-cta-buttons { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.switch-cta-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 32px;
  border-radius: 8px;
  font-size: 1.1em;
  font-weight: 600;
  text-decoration: none !important;
  transition: all 0.3s ease;
  white-space: nowrap;
}
.switch-cta-button.primary { background: var(--primary-color, #00356B); color: #fff !important; box-shadow: 0 4px 20px rgba(0,53,107,0.3); }
.switch-cta-button.primary:hover { background: var(--secondary-color, #1D231C); transform: translateY(-2px); box-shadow: 0 6px 25px rgba(0,53,107,0.4); }
.switch-cta-button.secondary { background: var(--accent-color, #B8860B); color: #fff !important; box-shadow: 0 4px 20px rgba(184,134,11,0.3); }
.switch-cta-button.secondary:hover { background: #9a7209; transform: translateY(-2px); box-shadow: 0 6px 25px rgba(184,134,11,0.4); }
.switch-cta-button:hover .button-arrow { transform: translateX(5px); }
@media screen and (max-width: 900px) {
  .switch-cta-section { flex-direction: column; text-align: center; gap: 50px; margin: 20px; }
  .switch-benefits { align-items: center; }
}
@media screen and (max-width: 767px) {
  .switch-cta-section { padding: 60px 20px; margin: 15px; border-radius: 20px; }
  .switch-cta-headline { font-size: 1.8em; }
  .old-phone { width: 105px; height: 220px; border-radius: 28px; padding: 8px; }
  .new-solution-img { height: 220px; }
}`;

const TESTIMONIALS_HTML = `<div class="testimonials-static-section">
  <div class="testimonials-header">
    <h2>{{sectionHeadline}}</h2>
  </div>
  <div class="testimonials-carousel">
    <div class="testimonials-track">
      <div class="testimonial-static-card active">
        <p class="testimonial-quote">"{{testimonial1_quote}}"</p>
        <div class="testimonial-footer">
          <div class="testimonial-author-info">
            <strong>{{testimonial1_author}}</strong>
            <span>{{testimonial1_role}}</span>
          </div>
          <div class="testimonial-logo">
            <img src="YOUR_COMPANY_LOGO_1_URL" alt="Company Name">
          </div>
        </div>
      </div>
      <div class="testimonial-static-card dark">
        <p class="testimonial-quote">"{{testimonial2_quote}}"</p>
        <div class="testimonial-footer">
          <div class="testimonial-author-info">
            <strong>{{testimonial2_author}}</strong>
            <span>{{testimonial2_role}}</span>
          </div>
          <div class="testimonial-logo">
            <img src="YOUR_COMPANY_LOGO_2_URL" alt="Company Name">
          </div>
        </div>
      </div>
    </div>
    <div class="testimonial-dots">
      <button class="testimonial-dot active" data-index="0"></button>
      <button class="testimonial-dot" data-index="1"></button>
    </div>
  </div>
</div>
<script>
(function() {
  var cards = document.querySelectorAll('.testimonial-static-card');
  var dots = document.querySelectorAll('.testimonial-dot');
  var currentIndex = 0;
  var autoplayInterval;
  function showTestimonial(index) {
    cards.forEach(function(card) { card.classList.remove('active'); });
    dots.forEach(function(dot) { dot.classList.remove('active'); });
    if (cards[index]) cards[index].classList.add('active');
    if (dots[index]) dots[index].classList.add('active');
    currentIndex = index;
  }
  function nextTestimonial() {
    var next = (currentIndex + 1) % cards.length;
    showTestimonial(next);
  }
  dots.forEach(function(dot, index) {
    dot.addEventListener('click', function() { showTestimonial(index); });
  });
  autoplayInterval = setInterval(nextTestimonial, 5000);
})();
</script>`;

const TESTIMONIALS_CSS = `.testimonials-static-section {
  padding: 80px 40px;
  background: var(--section-bg, #f8f7f5);
}
.testimonials-header { text-align: center; margin-bottom: 50px; }
.testimonials-header h2 { font-size: 2.2em; color: var(--primary-color, #00356B); }
.testimonials-carousel { max-width: 700px; margin: 0 auto; }
.testimonials-track { position: relative; height: 520px; }
.testimonial-static-card {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 100%;
  background: #fff;
  border: 2px solid var(--primary-color, #00356B);
  border-radius: 16px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.4s ease, visibility 0.4s ease;
  box-sizing: border-box;
}
.testimonial-static-card.active { opacity: 1; visibility: visible; }
.testimonial-static-card.dark {
  background: var(--primary-color, #00356B);
  border: none;
}
.testimonial-static-card.dark .testimonial-quote { color: #fff; }
.testimonial-static-card.dark .testimonial-author-info strong { color: #fff; }
.testimonial-static-card.dark .testimonial-author-info span { color: rgba(255,255,255,0.8); }
.testimonial-static-card.dark .testimonial-logo img { filter: brightness(0) invert(1); opacity: 0.9; }
.testimonial-quote {
  font-size: 1.05em;
  line-height: 1.8;
  color: var(--primary-color, #00356B);
  margin-bottom: 30px;
  font-weight: 500;
  flex-grow: 0;
}
.testimonial-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-top: auto;
}
.testimonial-author-info { display: flex; flex-direction: column; }
.testimonial-author-info strong { font-size: 1em; color: var(--primary-color, #00356B); font-style: italic; }
.testimonial-author-info span { font-size: 0.9em; color: var(--primary-color, #00356B); opacity: 0.8; font-style: italic; }
.testimonial-logo img { height: 60px; width: auto; }
.testimonial-dots { display: flex; justify-content: center; gap: 12px; margin-top: 30px; position: relative; z-index: 10; }
.testimonial-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  border: 2px solid var(--primary-color, #00356B);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: all 0.3s ease;
}
.testimonial-dot:hover { background: rgba(0, 53, 107, 0.3); }
.testimonial-dot.active { background: var(--primary-color, #00356B); }
@media screen and (max-width: 767px) {
  .testimonials-static-section { padding: 60px 20px; }
  .testimonial-static-card { padding: 30px; }
  .testimonials-header h2 { font-size: 1.8em; }
  .testimonial-footer { flex-direction: column; align-items: flex-start; }
}`;

const SAAS_ABOUT_HTML = `<div class="about-hero">
  <div class="about-hero-content">
    <span class="about-badge">{{aboutBadge}}</span>
    <h1>{{headline}}</h1>
    <p>{{subheadline}}</p>
  </div>
</div>
<div class="about-problem-section">
  <div class="about-problem-content">
    <h2>{{sectionHeadline}}</h2>
    <div class="problem-grid">
      <div class="problem-card">
        <div class="problem-icon">📋</div>
        <h3>{{problem1_title}}</h3>
        <p>{{problem1_body}}</p>
      </div>
      <div class="problem-card">
        <div class="problem-icon">🔒</div>
        <h3>{{problem2_title}}</h3>
        <p>{{problem2_body}}</p>
      </div>
      <div class="problem-card">
        <div class="problem-icon">⚡</div>
        <h3>{{problem3_title}}</h3>
        <p>{{problem3_body}}</p>
      </div>
    </div>
  </div>
</div>
<div class="about-approach-section">
  <div class="about-approach-content">
    <h2>{{approachHeadline}}</h2>
    <p class="approach-intro">{{approachIntro}}</p>
    <div class="approach-pillars">
      <div class="pillar">
        <div class="pillar-number">01</div>
        <div class="pillar-content">
          <h3>{{principle1_title}}</h3>
          <p>{{principle1_body}}</p>
        </div>
      </div>
      <div class="pillar">
        <div class="pillar-number">02</div>
        <div class="pillar-content">
          <h3>{{principle2_title}}</h3>
          <p>{{principle2_body}}</p>
        </div>
      </div>
      <div class="pillar">
        <div class="pillar-number">03</div>
        <div class="pillar-content">
          <h3>{{principle3_title}}</h3>
          <p>{{principle3_body}}</p>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="about-stats-section">
  <div class="about-stats-content">
    <h2>{{statsHeadline}}</h2>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-number">{{stat1_value}}</div>
        <div class="stat-label">{{stat1_label}}</div>
        <div class="stat-compare">{{stat1_compare}}</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">{{stat2_value}}</div>
        <div class="stat-label">{{stat2_label}}</div>
        <div class="stat-compare">{{stat2_compare}}</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">{{stat3_value}}</div>
        <div class="stat-label">{{stat3_label}}</div>
        <div class="stat-compare">{{stat3_compare}}</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">{{stat4_value}}</div>
        <div class="stat-label">{{stat4_label}}</div>
        <div class="stat-compare">{{stat4_compare}}</div>
      </div>
    </div>
  </div>
</div>
<div class="about-cta-section">
  <div class="about-cta-content">
    <h2>{{ctaHeadline}}</h2>
    <p>{{ctaSubheadline}}</p>
    <div class="about-cta-buttons">
      <a href="#" class="about-cta-btn primary">{{ctaText}}</a>
      <a href="#" class="about-cta-btn secondary">{{ctaSecondary}}</a>
    </div>
  </div>
</div>`;

const SAAS_ABOUT_CSS = `:root {
  --color-primary: #00356B;
  --color-primary-light: #004a96;
  --color-accent: #B8860B;
  --color-text: #1D231C;
  --color-bg-light: #f8f7f5;
  --color-border: #E1DFD9;
  --radius-small: 8px;
  --radius-medium: 16px;
  --radius-large: 25px;
}
.about-hero { padding: 100px 40px 80px; background: linear-gradient(135deg, var(--color-bg-light) 0%, #fff 100%); text-align: center; }
.about-hero-content { max-width: 800px; margin: 0 auto; }
.about-badge { display: inline-block; background: var(--color-primary); color: #fff; padding: 10px 24px; border-radius: var(--radius-large); font-size: 0.85em; font-weight: 600; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1.5px; }
.about-hero h1 { font-size: 3em; color: var(--color-text); line-height: 1.2; margin-bottom: 24px; }
.about-hero h1 span { color: var(--color-primary); }
.about-hero p { font-size: 1.25em; line-height: 1.7; color: var(--color-text); opacity: 0.85; }
.about-problem-section { padding: 80px 40px; background: #fff; }
.about-problem-content { max-width: 1100px; margin: 0 auto; }
.about-problem-content h2 { font-size: 2.2em; color: var(--color-primary); text-align: center; margin-bottom: 50px; }
.problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
.problem-card { background: var(--color-bg-light); border-radius: var(--radius-medium); padding: 35px 30px; border: 1px solid var(--color-border); transition: all 0.3s ease; }
.problem-card:hover { transform: translateY(-5px); box-shadow: 0 15px 35px rgba(0,0,0,0.08); }
.problem-icon { font-size: 2.5em; margin-bottom: 16px; }
.problem-card h3 { font-size: 1.3em; color: var(--color-primary); margin-bottom: 12px; }
.problem-card p { font-size: 1em; line-height: 1.7; color: var(--color-text); opacity: 0.85; margin: 0; }
.about-approach-section { padding: 80px 40px; background: var(--color-bg-light); }
.about-approach-content { max-width: 900px; margin: 0 auto; }
.about-approach-content h2 { font-size: 2.2em; color: var(--color-primary); text-align: center; margin-bottom: 16px; }
.approach-intro { font-size: 1.15em; color: var(--color-text); opacity: 0.8; text-align: center; margin-bottom: 50px; }
.approach-pillars { display: flex; flex-direction: column; gap: 40px; }
.pillar { display: grid; grid-template-columns: 80px 1fr; gap: 30px; align-items: start; }
.pillar-number { font-size: 2.5em; font-weight: 800; color: var(--color-accent); line-height: 1; }
.pillar-content h3 { font-size: 1.4em; color: var(--color-primary); margin-bottom: 10px; }
.pillar-content p { font-size: 1.05em; line-height: 1.7; color: var(--color-text); opacity: 0.85; margin: 0; }
.about-stats-section { padding: 80px 40px; background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%); }
.about-stats-content { max-width: 1000px; margin: 0 auto; text-align: center; }
.about-stats-content h2 { font-size: 2.2em; color: #fff; margin-bottom: 50px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 30px; }
.stat-item { padding: 30px 20px; border-radius: var(--radius-medium); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); transition: all 0.3s ease; }
.stat-item:hover { background: rgba(255,255,255,0.15); transform: translateY(-3px); }
.stat-number { font-size: 3em; font-weight: 800; color: var(--color-accent); line-height: 1; margin-bottom: 8px; }
.stat-label { font-size: 1.1em; font-weight: 600; color: #fff; margin-bottom: 6px; }
.stat-compare { font-size: 0.9em; color: rgba(255,255,255,0.7); }
.about-cta-section { padding: 80px 40px; background: #fff; text-align: center; }
.about-cta-content { max-width: 700px; margin: 0 auto; }
.about-cta-content h2 { font-size: 2.2em; color: var(--color-primary); margin-bottom: 16px; }
.about-cta-content p { font-size: 1.15em; line-height: 1.7; color: var(--color-text); opacity: 0.85; margin-bottom: 35px; }
.about-cta-buttons { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
.about-cta-btn { display: inline-block; padding: 16px 32px; border-radius: var(--radius-small); font-size: 1.1em; font-weight: 600; text-decoration: none !important; transition: all 0.3s ease; }
.about-cta-btn.primary { background: var(--color-primary); color: #fff !important; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
.about-cta-btn.primary:hover { background: var(--color-text); transform: translateY(-2px); box-shadow: 0 6px 25px rgba(0,0,0,0.25); }
.about-cta-btn.secondary { background: transparent; color: var(--color-primary) !important; border: 2px solid var(--color-primary); }
.about-cta-btn.secondary:hover { background: var(--color-primary); color: #fff !important; }
@media screen and (max-width: 900px) {
  .problem-grid { grid-template-columns: 1fr; gap: 20px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .pillar { grid-template-columns: 1fr; gap: 15px; text-align: center; }
}
@media screen and (max-width: 767px) {
  .about-hero { padding: 70px 20px 60px; }
  .about-hero h1 { font-size: 2em; }
  .about-problem-section, .about-approach-section, .about-stats-section, .about-cta-section { padding: 60px 20px; }
  .stats-grid { grid-template-columns: 1fr 1fr; gap: 15px; }
  .about-cta-buttons { flex-direction: column; }
  .about-cta-btn { width: 100%; text-align: center; }
}`;

const FEATURES_GRID_HTML = `<div class="features-grid-section">
  <div class="features-grid-header">
    <h2>{{sectionHeadline}}</h2>
    <p>{{sectionSubheadline}}</p>
  </div>
  <div class="features-grid">
    <div class="feature-card">
      <div class="feature-icon">🚀</div>
      <h3>{{feature1_title}}</h3>
      <ul>
        <li>{{feature1_body}}</li>
      </ul>
    </div>
    <div class="feature-card">
      <div class="feature-icon">💼</div>
      <h3>{{feature2_title}}</h3>
      <ul>
        <li>{{feature2_body}}</li>
      </ul>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🏠</div>
      <h3>{{feature3_title}}</h3>
      <ul>
        <li>{{feature3_body}}</li>
      </ul>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🏢</div>
      <h3>{{feature4_title}}</h3>
      <ul>
        <li>{{feature4_body}}</li>
      </ul>
    </div>
  </div>
</div>`;

const FEATURES_GRID_CSS = `.features-grid-section {
  padding: 80px 40px;
  background: var(--section-bg, #f8f7f5);
}
.features-grid-header { text-align: center; margin-bottom: 50px; }
.features-grid-header h2 { font-size: 2.4em; color: var(--primary-color, #00356B); margin-bottom: 12px; }
.features-grid-header p { font-size: 1.15em; color: var(--text-color, #1D231C); opacity: 0.75; }
.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 30px;
  max-width: 1200px;
  margin: 0 auto;
}
.feature-card {
  background: #fff;
  border: 2px solid var(--primary-color, #00356B);
  border-radius: 16px;
  padding: 30px;
  transition: all 0.3s ease;
  box-shadow: 0 10px 40px -10px rgba(0,53,107,0.2);
}
.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 0 50px rgba(0,53,107,0.3);
  border-color: var(--accent-color, #B8860B);
}
.feature-icon {
  font-size: 2.5em;
  margin-bottom: 16px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--border-color, #E1DFD9);
  border-radius: 12px;
  transition: all 0.3s ease;
}
.feature-card:hover .feature-icon {
  background: var(--primary-color, #00356B);
}
.feature-card h3 { font-size: 1.3em; color: var(--primary-color, #00356B); margin-bottom: 12px; }
.feature-card ul { list-style: none; padding: 0; margin: 0; }
.feature-card li {
  font-size: 0.95em;
  color: var(--text-color, #1D231C);
  opacity: 0.9;
  padding: 4px 0;
  padding-left: 20px;
  position: relative;
}
.feature-card li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--primary-color, #00356B);
  font-weight: 600;
}
@media screen and (max-width: 1024px) {
  .features-grid { grid-template-columns: repeat(2, 1fr); }
}
@media screen and (max-width: 767px) {
  .features-grid-section { padding: 60px 20px; }
  .features-grid { grid-template-columns: 1fr; gap: 20px; }
  .features-grid-header h2 { font-size: 1.8em; }
}`;

// --- Remaining 12 templates (real HTML/CSS) ---

const SINGLE_HERO_CTA_HTML = `<div class="single-hero">
  <div class="single-hero-inner">
    <h1>{{headline}}</h1>
    <p class="single-hero-sub">{{subheadline}}</p>
    <div class="single-hero-actions">
      <a href="#" class="single-hero-btn primary">{{ctaText}}</a>
      <a href="#" class="single-hero-btn secondary">{{ctaSecondary}}</a>
    </div>
  </div>
</div>`;

const SINGLE_HERO_CTA_CSS = `.single-hero {
  padding: 100px 40px 120px;
  text-align: center;
  background: linear-gradient(180deg, var(--section-bg, #f8f7f5) 0%, #fff 100%);
}
.single-hero-inner { max-width: 720px; margin: 0 auto; }
.single-hero h1 {
  font-size: 3em;
  line-height: 1.15;
  color: var(--primary-color, #00356B);
  margin-bottom: 24px;
}
.single-hero-sub {
  font-size: 1.25em;
  line-height: 1.7;
  color: var(--text-color, #1D231C);
  opacity: 0.9;
  margin-bottom: 40px;
}
.single-hero-actions { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
.single-hero-btn {
  display: inline-block;
  padding: 16px 36px;
  border-radius: 8px;
  font-size: 1.1em;
  font-weight: 600;
  text-decoration: none !important;
  transition: all 0.3s ease;
}
.single-hero-btn.primary {
  background: var(--primary-color, #00356B);
  color: #fff !important;
  box-shadow: 0 4px 20px rgba(0,53,107,0.3);
}
.single-hero-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 28px rgba(0,53,107,0.4);
}
.single-hero-btn.secondary {
  background: transparent;
  color: var(--primary-color, #00356B) !important;
  border: 2px solid var(--primary-color, #00356B);
}
.single-hero-btn.secondary:hover {
  background: var(--primary-color, #00356B);
  color: #fff !important;
}
@media screen and (max-width: 767px) {
  .single-hero { padding: 70px 20px 90px; }
  .single-hero h1 { font-size: 2em; }
  .single-hero-sub { font-size: 1.05em; }
  .single-hero-actions { flex-direction: column; }
  .single-hero-btn { width: 100%; text-align: center; }
}`;

const STATS_BAR_HTML = `<div class="stats-bar-section">
  <div class="stats-bar-inner">
    <div class="stat-item">
      <span class="stat-value">{{stat1_value}}</span>
      <span class="stat-label">{{stat1_label}}</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">{{stat2_value}}</span>
      <span class="stat-label">{{stat2_label}}</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">{{stat3_value}}</span>
      <span class="stat-label">{{stat3_label}}</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">{{stat4_value}}</span>
      <span class="stat-label">{{stat4_label}}</span>
    </div>
  </div>
</div>`;

const STATS_BAR_CSS = `.stats-bar-section {
  padding: 50px 40px;
  background: var(--primary-color, #00356B);
  color: #fff;
}
.stats-bar-inner {
  display: flex;
  justify-content: space-around;
  align-items: center;
  max-width: 1000px;
  margin: 0 auto;
  gap: 30px;
  flex-wrap: wrap;
}
.stat-item {
  text-align: center;
  flex: 1;
  min-width: 120px;
}
.stat-value {
  display: block;
  font-size: 2.5em;
  font-weight: 800;
  color: var(--accent-color, #B8860B);
  line-height: 1.2;
  margin-bottom: 6px;
}
.stat-label {
  font-size: 0.95em;
  opacity: 0.9;
}
@media screen and (max-width: 767px) {
  .stats-bar-section { padding: 40px 20px; }
  .stats-bar-inner { flex-direction: column; gap: 40px; }
  .stat-value { font-size: 2em; }
}`;

const PRICING_CARDS_HTML = `<div class="pricing-section">
  <div class="pricing-header">
    <h2>{{sectionHeadline}}</h2>
    <p>{{sectionSubheadline}}</p>
  </div>
  <div class="pricing-grid">
    <div class="pricing-card">
      <h3>{{pricing1_title}}</h3>
      <div class="pricing-amount"><span class="currency">$</span><span class="amount">{{pricing1_amount}}</span><span class="period">/mo</span></div>
      <ul class="pricing-features">
        <li>{{pricing1_feature1}}</li>
        <li>{{pricing1_feature2}}</li>
        <li>{{pricing1_feature3}}</li>
      </ul>
      <a href="#" class="pricing-cta">{{ctaText}}</a>
    </div>
    <div class="pricing-card featured">
      <span class="pricing-badge">Popular</span>
      <h3>{{pricing2_title}}</h3>
      <div class="pricing-amount"><span class="currency">$</span><span class="amount">{{pricing2_amount}}</span><span class="period">/mo</span></div>
      <ul class="pricing-features">
        <li>{{pricing2_feature1}}</li>
        <li>{{pricing2_feature2}}</li>
        <li>{{pricing2_feature3}}</li>
        <li>{{pricing2_feature4}}</li>
      </ul>
      <a href="#" class="pricing-cta primary">{{ctaText}}</a>
    </div>
    <div class="pricing-card">
      <h3>{{pricing3_title}}</h3>
      <div class="pricing-amount"><span class="currency">$</span><span class="amount">{{pricing3_amount}}</span><span class="period">/mo</span></div>
      <ul class="pricing-features">
        <li>{{pricing3_feature1}}</li>
        <li>{{pricing3_feature2}}</li>
        <li>{{pricing3_feature3}}</li>
      </ul>
      <a href="#" class="pricing-cta">{{ctaSecondary}}</a>
    </div>
  </div>
</div>`;

const PRICING_CARDS_CSS = `.pricing-section {
  padding: 80px 40px;
  background: var(--section-bg, #f8f7f5);
}
.pricing-header { text-align: center; margin-bottom: 50px; }
.pricing-header h2 { font-size: 2.4em; color: var(--primary-color, #00356B); margin-bottom: 12px; }
.pricing-header p { font-size: 1.15em; color: var(--text-color, #1D231C); opacity: 0.8; }
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 30px;
  max-width: 1000px;
  margin: 0 auto;
  align-items: stretch;
}
.pricing-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px 30px;
  border: 2px solid var(--border-color, #E1DFD9);
  position: relative;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}
.pricing-card:hover { border-color: var(--primary-color, #00356B); box-shadow: 0 15px 40px rgba(0,53,107,0.12); }
.pricing-card.featured {
  border-color: var(--primary-color, #00356B);
  box-shadow: 0 15px 50px rgba(0,53,107,0.2);
  transform: scale(1.03);
}
.pricing-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent-color, #B8860B);
  color: #fff;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.8em;
  font-weight: 600;
}
.pricing-card h3 { font-size: 1.4em; color: var(--primary-color, #00356B); margin-bottom: 20px; }
.pricing-amount { margin-bottom: 24px; }
.pricing-amount .currency { font-size: 1.2em; color: var(--text-color, #1D231C); }
.pricing-amount .amount { font-size: 3em; font-weight: 800; color: var(--primary-color, #00356B); }
.pricing-amount .period { font-size: 1em; color: var(--text-color, #1D231C); opacity: 0.7; }
.pricing-features { list-style: none; padding: 0; margin: 0 0 30px; flex-grow: 1; }
.pricing-features li {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color, #E1DFD9);
  color: var(--text-color, #1D231C);
  font-size: 0.95em;
}
.pricing-features li:last-child { border-bottom: none; }
.pricing-cta {
  display: block;
  text-align: center;
  padding: 14px 24px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none !important;
  transition: all 0.3s ease;
  border: 2px solid var(--primary-color, #00356B);
  color: var(--primary-color, #00356B) !important;
}
.pricing-cta:hover { background: var(--primary-color, #00356B); color: #fff !important; }
.pricing-cta.primary {
  background: var(--primary-color, #00356B);
  color: #fff !important;
  border-color: var(--primary-color, #00356B);
}
.pricing-cta.primary:hover { background: var(--secondary-color, #1D231C); border-color: var(--secondary-color, #1D231C); }
@media screen and (max-width: 900px) {
  .pricing-grid { grid-template-columns: 1fr; max-width: 400px; margin-left: auto; margin-right: auto; }
  .pricing-card.featured { transform: none; }
}
@media screen and (max-width: 767px) {
  .pricing-section { padding: 60px 20px; }
  .pricing-header h2 { font-size: 1.8em; }
}`;

const FAQ_ACCORDION_HTML = `<div class="faq-section">
  <div class="faq-header">
    <h2>{{sectionHeadline}}</h2>
    <p>{{sectionSubheadline}}</p>
  </div>
  <div class="faq-list">
    <div class="faq-item">
      <button class="faq-question" type="button" aria-expanded="false" aria-controls="faq-1" id="faq-q-1">{{faq1_question}}</button>
      <div class="faq-answer" id="faq-1" aria-labelledby="faq-q-1" hidden>{{faq1_answer}}</div>
    </div>
    <div class="faq-item">
      <button class="faq-question" type="button" aria-expanded="false" aria-controls="faq-2" id="faq-q-2">{{faq2_question}}</button>
      <div class="faq-answer" id="faq-2" aria-labelledby="faq-q-2" hidden>{{faq2_answer}}</div>
    </div>
    <div class="faq-item">
      <button class="faq-question" type="button" aria-expanded="false" aria-controls="faq-3" id="faq-q-3">{{faq3_question}}</button>
      <div class="faq-answer" id="faq-3" aria-labelledby="faq-q-3" hidden>{{faq3_answer}}</div>
    </div>
    <div class="faq-item">
      <button class="faq-question" type="button" aria-expanded="false" aria-controls="faq-4" id="faq-q-4">{{faq4_question}}</button>
      <div class="faq-answer" id="faq-4" aria-labelledby="faq-q-4" hidden>{{faq4_answer}}</div>
    </div>
  </div>
</div>
<script>
(function() {
  document.querySelectorAll('.faq-question').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var expanded = this.getAttribute('aria-expanded') === 'true';
      var answer = document.getElementById(this.getAttribute('aria-controls'));
      document.querySelectorAll('.faq-question').forEach(function(b) { b.setAttribute('aria-expanded', 'false'); });
      document.querySelectorAll('.faq-answer').forEach(function(a) { a.hidden = true; });
      document.querySelectorAll('.faq-item').forEach(function(i) { i.classList.remove('open'); });
      if (!expanded) {
        this.setAttribute('aria-expanded', 'true');
        if (answer) answer.hidden = false;
        this.closest('.faq-item').classList.add('open');
      }
    });
  });
})();
</script>`;

const FAQ_ACCORDION_CSS = `.faq-section {
  padding: 80px 40px;
  background: #fff;
}
.faq-header { text-align: center; margin-bottom: 50px; }
.faq-header h2 { font-size: 2.4em; color: var(--primary-color, #00356B); margin-bottom: 12px; }
.faq-header p { font-size: 1.15em; color: var(--text-color, #1D231C); opacity: 0.8; }
.faq-list { max-width: 700px; margin: 0 auto; }
.faq-item {
  border-bottom: 1px solid var(--border-color, #E1DFD9);
  transition: all 0.3s ease;
}
.faq-question {
  width: 100%;
  padding: 24px 0;
  text-align: left;
  background: none;
  border: none;
  font-size: 1.15em;
  font-weight: 600;
  color: var(--primary-color, #00356B);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.faq-question::after {
  content: '+';
  font-size: 1.5em;
  color: var(--accent-color, #B8860B);
  flex-shrink: 0;
  transition: transform 0.3s ease;
}
.faq-item.open .faq-question::after { content: '−'; }
.faq-question:hover { color: var(--accent-color, #B8860B); }
.faq-answer {
  padding: 0 0 24px;
  font-size: 1em;
  line-height: 1.7;
  color: var(--text-color, #1D231C);
  opacity: 0.9;
}
@media screen and (max-width: 767px) {
  .faq-section { padding: 60px 20px; }
  .faq-header h2 { font-size: 1.8em; }
  .faq-question { font-size: 1.05em; }
}`;

const CONTACT_FORM_HERO_HTML = `<div class="contact-hero">
  <div class="contact-hero-grid">
    <div class="contact-hero-content">
      <h1>{{headline}}</h1>
      <p>{{subheadline}}</p>
      <div class="contact-info">
        <div class="contact-info-item">📧 {{contact_email}}</div>
        <div class="contact-info-item">📞 {{contact_phone}}</div>
      </div>
    </div>
    <div class="contact-hero-form-wrap">
      <form class="contact-form" action="#" method="post">
        <input type="text" name="name" placeholder="Your Name" required>
        <input type="email" name="email" placeholder="Email Address" required>
        <input type="tel" name="phone" placeholder="Phone (optional)">
        <textarea name="message" placeholder="How can we help?" rows="4" required></textarea>
        <button type="submit" class="contact-submit">{{ctaText}}</button>
      </form>
    </div>
  </div>
</div>`;

const CONTACT_FORM_HERO_CSS = `.contact-hero {
  padding: 80px 40px;
  background: var(--section-bg, #f8f7f5);
}
.contact-hero-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: start;
  max-width: 1000px;
  margin: 0 auto;
}
.contact-hero-content h1 {
  font-size: 2.5em;
  color: var(--primary-color, #00356B);
  margin-bottom: 20px;
}
.contact-hero-content p {
  font-size: 1.15em;
  line-height: 1.7;
  color: var(--text-color, #1D231C);
  opacity: 0.9;
  margin-bottom: 30px;
}
.contact-info { display: flex; flex-direction: column; gap: 12px; }
.contact-info-item {
  font-size: 1em;
  color: var(--primary-color, #00356B);
  font-weight: 500;
}
.contact-hero-form-wrap {
  background: #fff;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 15px 50px rgba(0,0,0,0.08);
  border: 1px solid var(--border-color, #E1DFD9);
}
.contact-form { display: flex; flex-direction: column; gap: 16px; }
.contact-form input, .contact-form textarea {
  padding: 14px 18px;
  border: 2px solid var(--border-color, #E1DFD9);
  border-radius: 8px;
  font-size: 1em;
  font-family: inherit;
  transition: border-color 0.3s ease;
}
.contact-form input:focus, .contact-form textarea:focus {
  outline: none;
  border-color: var(--primary-color, #00356B);
}
.contact-form textarea { resize: vertical; min-height: 100px; }
.contact-submit {
  padding: 16px 32px;
  background: var(--primary-color, #00356B);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1.1em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}
.contact-submit:hover { background: var(--secondary-color, #1D231C); transform: translateY(-2px); }
@media screen and (max-width: 767px) {
  .contact-hero { padding: 60px 20px; }
  .contact-hero-grid { grid-template-columns: 1fr; gap: 40px; }
  .contact-hero-content h1 { font-size: 2em; }
  .contact-hero-form-wrap { padding: 30px; }
}`;

const SPLIT_IMAGE_CONTENT_HTML = `<div class="split-section">
  <div class="split-content">
    <h2>{{sectionHeadline}}</h2>
    <p>{{sectionSubheadline}}</p>
    <ul class="split-list">
      <li>{{benefit1}}</li>
      <li>{{benefit2}}</li>
      <li>{{benefit3}}</li>
    </ul>
    <a href="#" class="split-cta">{{ctaText}}</a>
  </div>
  <div class="split-image">
    <img src="YOUR_IMAGE_URL" alt="Supporting visual">
  </div>
</div>`;

const SPLIT_IMAGE_CONTENT_CSS = `.split-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
  padding: 80px 40px;
  max-width: 1200px;
  margin: 0 auto;
}
.split-content h2 {
  font-size: 2.4em;
  color: var(--primary-color, #00356B);
  margin-bottom: 20px;
}
.split-content p {
  font-size: 1.15em;
  line-height: 1.7;
  color: var(--text-color, #1D231C);
  opacity: 0.9;
  margin-bottom: 24px;
}
.split-list {
  list-style: none;
  padding: 0;
  margin: 0 0 30px;
}
.split-list li {
  padding: 8px 0;
  padding-left: 28px;
  position: relative;
  color: var(--text-color, #1D231C);
  font-size: 1.05em;
}
.split-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--accent-color, #B8860B);
  font-weight: 700;
}
.split-cta {
  display: inline-block;
  color: var(--primary-color, #00356B) !important;
  font-weight: 600;
  text-decoration: none !important;
  transition: color 0.3s ease;
}
.split-cta:hover { color: var(--accent-color, #B8860B) !important; }
.split-image {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.12);
}
.split-image img { width: 100%; height: auto; display: block; }
@media screen and (max-width: 900px) {
  .split-section { grid-template-columns: 1fr; }
  .split-image { order: -1; }
}
@media screen and (max-width: 767px) {
  .split-section { padding: 60px 20px; gap: 40px; }
  .split-content h2 { font-size: 1.9em; }
}`;

const NAV_AND_HERO_HTML = `<header class="nav-hero-nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">{{brandName}}</a>
    <nav class="nav-links">
      <a href="#">Services</a>
      <a href="#">About</a>
      <a href="#">Contact</a>
    </nav>
    <a href="#" class="nav-cta">{{ctaText}}</a>
  </div>
</header>
<div class="nav-hero-hero">
  <div class="nav-hero-inner">
    <h1>{{headline}}</h1>
    <p>{{subheadline}}</p>
    <a href="#" class="nav-hero-btn">{{ctaText}}</a>
  </div>
</div>`;

const NAV_AND_HERO_CSS = `.nav-hero-nav {
  padding: 20px 40px;
  background: #fff;
  border-bottom: 1px solid var(--border-color, #E1DFD9);
}
.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
}
.nav-logo {
  font-size: 1.3em;
  font-weight: 700;
  color: var(--primary-color, #00356B) !important;
  text-decoration: none !important;
}
.nav-links { display: flex; gap: 32px; }
.nav-links a {
  color: var(--text-color, #1D231C) !important;
  text-decoration: none !important;
  font-weight: 500;
  transition: color 0.3s ease;
}
.nav-links a:hover { color: var(--primary-color, #00356B) !important; }
.nav-cta {
  padding: 10px 24px;
  background: var(--primary-color, #00356B);
  color: #fff !important;
  text-decoration: none !important;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}
.nav-cta:hover { background: var(--secondary-color, #1D231C); }
.nav-hero-hero {
  padding: 100px 40px 120px;
  text-align: center;
  background: linear-gradient(180deg, var(--section-bg, #f8f7f5) 0%, #fff 100%);
}
.nav-hero-inner { max-width: 720px; margin: 0 auto; }
.nav-hero-hero h1 {
  font-size: 3em;
  color: var(--primary-color, #00356B);
  margin-bottom: 24px;
  line-height: 1.15;
}
.nav-hero-hero p {
  font-size: 1.2em;
  line-height: 1.7;
  color: var(--text-color, #1D231C);
  opacity: 0.9;
  margin-bottom: 36px;
}
.nav-hero-btn {
  display: inline-block;
  padding: 16px 36px;
  background: var(--primary-color, #00356B);
  color: #fff !important;
  text-decoration: none !important;
  border-radius: 8px;
  font-size: 1.1em;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0,53,107,0.3);
}
.nav-hero-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 28px rgba(0,53,107,0.4);
}
@media screen and (max-width: 767px) {
  .nav-hero-nav { padding: 16px 20px; }
  .nav-inner { flex-wrap: wrap; gap: 16px; }
  .nav-links { order: 3; width: 100%; justify-content: center; gap: 20px; }
  .nav-hero-hero { padding: 70px 20px 90px; }
  .nav-hero-hero h1 { font-size: 2em; }
}`;

const FOOTER_CTA_HTML = `<div class="footer-cta-section">
  <div class="footer-cta-inner">
    <h2>{{sectionHeadline}}</h2>
    <p>{{sectionSubheadline}}</p>
    <div class="footer-cta-buttons">
      <a href="#" class="footer-cta-btn primary">{{ctaText}}</a>
      <a href="#" class="footer-cta-btn secondary">{{ctaSecondary}}</a>
    </div>
  </div>
</div>`;

const FOOTER_CTA_CSS = `.footer-cta-section {
  padding: 60px 40px;
  background: var(--primary-color, #00356B);
  text-align: center;
}
.footer-cta-inner { max-width: 700px; margin: 0 auto; }
.footer-cta-section h2 {
  font-size: 2.2em;
  color: #fff;
  margin-bottom: 16px;
}
.footer-cta-section p {
  font-size: 1.15em;
  color: rgba(255,255,255,0.9);
  margin-bottom: 30px;
}
.footer-cta-buttons { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
.footer-cta-btn {
  display: inline-block;
  padding: 14px 32px;
  border-radius: 8px;
  font-size: 1.05em;
  font-weight: 600;
  text-decoration: none !important;
  transition: all 0.3s ease;
}
.footer-cta-btn.primary {
  background: var(--accent-color, #B8860B);
  color: #fff !important;
  box-shadow: 0 4px 20px rgba(184,134,11,0.4);
}
.footer-cta-btn.primary:hover {
  background: #9a7209;
  transform: translateY(-2px);
}
.footer-cta-btn.secondary {
  background: transparent;
  color: #fff !important;
  border: 2px solid rgba(255,255,255,0.8);
}
.footer-cta-btn.secondary:hover {
  background: rgba(255,255,255,0.15);
}
@media screen and (max-width: 767px) {
  .footer-cta-section { padding: 50px 20px; }
  .footer-cta-section h2 { font-size: 1.8em; }
  .footer-cta-buttons { flex-direction: column; }
  .footer-cta-btn { width: 100%; text-align: center; }
}`;

const CARD_GRID_HTML = `<div class="card-grid-section">
  <div class="card-grid-header">
    <h2>{{sectionHeadline}}</h2>
    <p>{{sectionSubheadline}}</p>
  </div>
  <div class="card-grid">
    <div class="card-grid-item">
      <div class="card-grid-icon">🏠</div>
      <h3>{{feature1_title}}</h3>
      <p>{{feature1_body}}</p>
      <a href="#" class="card-grid-link">{{ctaText}}</a>
    </div>
    <div class="card-grid-item">
      <div class="card-grid-icon">💼</div>
      <h3>{{feature2_title}}</h3>
      <p>{{feature2_body}}</p>
      <a href="#" class="card-grid-link">{{ctaText}}</a>
    </div>
    <div class="card-grid-item">
      <div class="card-grid-icon">⚡</div>
      <h3>{{feature3_title}}</h3>
      <p>{{feature3_body}}</p>
      <a href="#" class="card-grid-link">{{ctaText}}</a>
    </div>
  </div>
</div>`;

const CARD_GRID_CSS = `.card-grid-section {
  padding: 80px 40px;
  background: var(--section-bg, #f8f7f5);
}
.card-grid-header { text-align: center; margin-bottom: 50px; }
.card-grid-header h2 { font-size: 2.4em; color: var(--primary-color, #00356B); margin-bottom: 12px; }
.card-grid-header p { font-size: 1.15em; color: var(--text-color, #1D231C); opacity: 0.8; }
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 30px;
  max-width: 1100px;
  margin: 0 auto;
}
.card-grid-item {
  background: #fff;
  border-radius: 16px;
  padding: 40px 30px;
  border: 1px solid var(--border-color, #E1DFD9);
  transition: all 0.3s ease;
}
.card-grid-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 50px rgba(0,0,0,0.1);
  border-color: var(--primary-color, #00356B);
}
.card-grid-icon {
  font-size: 2.5em;
  margin-bottom: 20px;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--section-bg, #f8f7f5);
  border-radius: 12px;
}
.card-grid-item h3 { font-size: 1.3em; color: var(--primary-color, #00356B); margin-bottom: 12px; }
.card-grid-item p {
  font-size: 1em;
  line-height: 1.7;
  color: var(--text-color, #1D231C);
  opacity: 0.9;
  margin-bottom: 20px;
}
.card-grid-link {
  color: var(--primary-color, #00356B) !important;
  font-weight: 600;
  text-decoration: none !important;
  transition: color 0.3s ease;
}
.card-grid-link:hover { color: var(--accent-color, #B8860B) !important; }
@media screen and (max-width: 900px) {
  .card-grid { grid-template-columns: 1fr; }
}
@media screen and (max-width: 767px) {
  .card-grid-section { padding: 60px 20px; }
  .card-grid-header h2 { font-size: 1.8em; }
}`;

const TIMELINE_HTML = `<div class="timeline-section">
  <div class="timeline-header">
    <h2>{{sectionHeadline}}</h2>
    <p>{{sectionSubheadline}}</p>
  </div>
  <div class="timeline">
    <div class="timeline-item">
      <div class="timeline-marker">1</div>
      <div class="timeline-content">
        <h3>{{process1_title}}</h3>
        <p>{{process1_body}}</p>
      </div>
    </div>
    <div class="timeline-item">
      <div class="timeline-marker">2</div>
      <div class="timeline-content">
        <h3>{{process2_title}}</h3>
        <p>{{process2_body}}</p>
      </div>
    </div>
    <div class="timeline-item">
      <div class="timeline-marker">3</div>
      <div class="timeline-content">
        <h3>{{process3_title}}</h3>
        <p>{{process3_body}}</p>
      </div>
    </div>
    <div class="timeline-item">
      <div class="timeline-marker">4</div>
      <div class="timeline-content">
        <h3>{{process4_title}}</h3>
        <p>{{process4_body}}</p>
      </div>
    </div>
  </div>
</div>`;

const TIMELINE_CSS = `.timeline-section {
  padding: 80px 40px;
  background: #fff;
}
.timeline-header { text-align: center; margin-bottom: 60px; }
.timeline-header h2 { font-size: 2.4em; color: var(--primary-color, #00356B); margin-bottom: 12px; }
.timeline-header p { font-size: 1.15em; color: var(--text-color, #1D231C); opacity: 0.8; }
.timeline {
  max-width: 700px;
  margin: 0 auto;
  position: relative;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 30px;
  top: 40px;
  bottom: 40px;
  width: 2px;
  background: var(--border-color, #E1DFD9);
}
.timeline-item {
  display: flex;
  gap: 30px;
  margin-bottom: 40px;
  position: relative;
}
.timeline-item:last-child { margin-bottom: 0; }
.timeline-marker {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--primary-color, #00356B);
  color: #fff;
  font-size: 1.4em;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.timeline-content {
  padding-top: 8px;
}
.timeline-content h3 {
  font-size: 1.35em;
  color: var(--primary-color, #00356B);
  margin-bottom: 10px;
}
.timeline-content p {
  font-size: 1em;
  line-height: 1.7;
  color: var(--text-color, #1D231C);
  opacity: 0.9;
  margin: 0;
}
@media screen and (max-width: 767px) {
  .timeline-section { padding: 60px 20px; }
  .timeline::before { left: 20px; }
  .timeline-item { gap: 20px; margin-bottom: 30px; }
  .timeline-marker { width: 40px; height: 40px; font-size: 1.1em; }
  .timeline-header h2 { font-size: 1.8em; }
}`;

const COMPARISON_TABLE_HTML = `<div class="comparison-section">
  <div class="comparison-header">
    <h2>{{sectionHeadline}}</h2>
    <p>{{sectionSubheadline}}</p>
  </div>
  <div class="comparison-table-wrap">
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Feature</th>
          <th>Starter</th>
          <th>Pro</th>
          <th>Enterprise</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Core features</td>
          <td>✓</td>
          <td>✓</td>
          <td>✓</td>
        </tr>
        <tr>
          <td>Priority support</td>
          <td>—</td>
          <td>✓</td>
          <td>✓</td>
        </tr>
        <tr>
          <td>Custom integrations</td>
          <td>—</td>
          <td>—</td>
          <td>✓</td>
        </tr>
        <tr>
          <td>Dedicated manager</td>
          <td>—</td>
          <td>—</td>
          <td>✓</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>`;

const COMPARISON_TABLE_CSS = `.comparison-section {
  padding: 80px 40px;
  background: var(--section-bg, #f8f7f5);
}
.comparison-header { text-align: center; margin-bottom: 50px; }
.comparison-header h2 { font-size: 2.4em; color: var(--primary-color, #00356B); margin-bottom: 12px; }
.comparison-header p { font-size: 1.15em; color: var(--text-color, #1D231C); opacity: 0.8; }
.comparison-table-wrap {
  max-width: 900px;
  margin: 0 auto;
  overflow-x: auto;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.08);
}
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}
.comparison-table th, .comparison-table td {
  padding: 18px 24px;
  text-align: left;
  border-bottom: 1px solid var(--border-color, #E1DFD9);
}
.comparison-table th {
  background: var(--primary-color, #00356B);
  color: #fff;
  font-weight: 600;
  font-size: 1.05em;
}
.comparison-table th:first-child { border-radius: 12px 0 0 0; }
.comparison-table th:last-child { border-radius: 0 12px 0 0; }
.comparison-table tbody tr:hover { background: rgba(0,53,107,0.04); }
.comparison-table td:first-child { font-weight: 500; color: var(--text-color, #1D231C); }
.comparison-table td:not(:first-child) { text-align: center; color: var(--primary-color, #00356B); }
@media screen and (max-width: 767px) {
  .comparison-section { padding: 60px 20px; }
  .comparison-header h2 { font-size: 1.8em; }
  .comparison-table th, .comparison-table td { padding: 14px 16px; font-size: 0.95em; }
}`;

const MINIMAL_HERO_HTML = `<section class="minimal-hero">
  <h1>{{headline}}</h1>
  <p class="minimal-hero-sub">{{subheadline}}</p>
  <a href="#" class="minimal-hero-cta">{{ctaText}}</a>
</section>`;

const MINIMAL_HERO_CSS = `.minimal-hero {
  padding: 80px 40px 100px;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
}
.minimal-hero h1 {
  font-size: 2.5em;
  color: var(--primary-color, #00356B);
  margin-bottom: 12px;
  font-weight: 700;
}
.minimal-hero-sub {
  font-size: 1.15em;
  color: var(--text-color, #1D231C);
  opacity: 0.85;
  margin-bottom: 28px;
}
.minimal-hero-cta {
  display: inline-block;
  padding: 14px 32px;
  background: var(--primary-color, #00356B);
  color: #fff !important;
  text-decoration: none !important;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}
.minimal-hero-cta:hover {
  background: var(--secondary-color, #1D231C);
  transform: translateY(-2px);
}
@media screen and (max-width: 767px) {
  .minimal-hero { padding: 60px 20px 80px; }
  .minimal-hero h1 { font-size: 1.9em; }
}`;

export const TEMPLATE_NAMES = [
  "dual-hero",
  "logo-marquee",
  "ios-card-fan",
  "dual-demo-screenshots",
  "switch-provider-cta",
  "testimonials-carousel",
  "saas-about-page",
  "features-grid",
  "single-hero-cta",
  "stats-bar",
  "pricing-cards",
  "faq-accordion",
  "contact-form-hero",
  "split-image-content",
  "nav-and-hero",
  "footer-cta",
  "card-grid",
  "timeline",
  "comparison-table",
  "minimal-hero",
] as const;

const DEFAULT_INDUSTRIES = [
  "Accountants",
  "Lawyers",
  "Restaurants",
  "Dentists",
  "General Contractors",
];

export const TEMPLATES: TemplateSeed[] = [
  {
    name: "dual-hero",
    description: "Dual-column hero with headline and CTA (macOS-style device frame)",
    category: "hero",
    htmlTemplate: DUAL_HERO_HTML,
    cssTemplate: DUAL_HERO_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "logo-marquee",
    description: "Logo strip / partner logos (infinite scroll, grayscale → color on hover)",
    category: "social-proof",
    htmlTemplate: LOGO_MARQUEE_HTML,
    cssTemplate: LOGO_MARQUEE_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "ios-card-fan",
    description: "Card-based layout with overlapping cards (use cases / features)",
    category: "features",
    htmlTemplate: IOS_CARD_FAN_HTML,
    cssTemplate: IOS_CARD_FAN_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "dual-demo-screenshots",
    description: "Screenshot carousel + scheduling widget (Calendly, Cal.com)",
    category: "hero",
    htmlTemplate: DUAL_DEMO_HTML,
    cssTemplate: DUAL_DEMO_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "switch-provider-cta",
    description: "Switch provider / comparison CTA (Old → New visual)",
    category: "cta",
    htmlTemplate: SWITCH_PROVIDER_HTML,
    cssTemplate: SWITCH_PROVIDER_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "testimonials-carousel",
    description: "Testimonials carousel (alternating light/dark cards)",
    category: "testimonials",
    htmlTemplate: TESTIMONIALS_HTML,
    cssTemplate: TESTIMONIALS_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "saas-about-page",
    description: "SaaS-style about page (hero + problem + approach + stats + CTA)",
    category: "about",
    htmlTemplate: SAAS_ABOUT_HTML,
    cssTemplate: SAAS_ABOUT_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "features-grid",
    description: "Feature grid with icons (use cases / industries)",
    category: "features",
    htmlTemplate: FEATURES_GRID_HTML,
    cssTemplate: FEATURES_GRID_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "single-hero-cta",
    description: "Single column hero with CTA",
    category: "hero",
    htmlTemplate: SINGLE_HERO_CTA_HTML,
    cssTemplate: SINGLE_HERO_CTA_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "stats-bar",
    description: "Stats / numbers bar",
    category: "social-proof",
    htmlTemplate: STATS_BAR_HTML,
    cssTemplate: STATS_BAR_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "pricing-cards",
    description: "Pricing cards",
    category: "pricing",
    htmlTemplate: PRICING_CARDS_HTML,
    cssTemplate: PRICING_CARDS_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "faq-accordion",
    description: "FAQ accordion section",
    category: "faq",
    htmlTemplate: FAQ_ACCORDION_HTML,
    cssTemplate: FAQ_ACCORDION_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "contact-form-hero",
    description: "Hero with contact form",
    category: "hero",
    htmlTemplate: CONTACT_FORM_HERO_HTML,
    cssTemplate: CONTACT_FORM_HERO_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "split-image-content",
    description: "Split image and content",
    category: "hero",
    htmlTemplate: SPLIT_IMAGE_CONTENT_HTML,
    cssTemplate: SPLIT_IMAGE_CONTENT_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "nav-and-hero",
    description: "Nav plus hero",
    category: "hero",
    htmlTemplate: NAV_AND_HERO_HTML,
    cssTemplate: NAV_AND_HERO_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "footer-cta",
    description: "Footer CTA strip",
    category: "cta",
    htmlTemplate: FOOTER_CTA_HTML,
    cssTemplate: FOOTER_CTA_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "card-grid",
    description: "Generic card grid",
    category: "features",
    htmlTemplate: CARD_GRID_HTML,
    cssTemplate: CARD_GRID_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "timeline",
    description: "Timeline / process",
    category: "about",
    htmlTemplate: TIMELINE_HTML,
    cssTemplate: TIMELINE_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "comparison-table",
    description: "Comparison table",
    category: "features",
    htmlTemplate: COMPARISON_TABLE_HTML,
    cssTemplate: COMPARISON_TABLE_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
  {
    name: "minimal-hero",
    description: "Minimal hero and CTA",
    category: "hero",
    htmlTemplate: MINIMAL_HERO_HTML,
    cssTemplate: MINIMAL_HERO_CSS,
    suitableIndustries: DEFAULT_INDUSTRIES,
  },
];
