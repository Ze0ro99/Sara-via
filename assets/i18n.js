(() => {
  'use strict';
  const translations = {
    en: {
      'nav.discover':'Discover','nav.flights':'Flights','nav.hotels':'Hotels','nav.cruises':'Cruises','nav.experiences':'Experiences','nav.web3':'Web3','nav.partner':'Become a Partner',
      'hero.eyebrow':'THE WORLD IS YOURS TO EXPLORE','hero.title':'Travel Beyond Boundaries.','hero.description':'One intelligent travel platform for extraordinary destinations, premium stays, unforgettable experiences and a new generation of Web3 travel.','hero.explore':'Explore the World','hero.web3':'Discover Web3',
      'search.kicker':'YOUR JOURNEY STARTS HERE','search.title':'Where will you go next?','search.description':'Search the world through one premium travel experience.',
      'search.from':'From','search.to':'To','search.date':'Date','search.guests':'Guests','search.submit':'Search',
      'provider.kicker':'PARTNER WITH SARA VIA','provider.title':'Bring your service to a world of travelers.','provider.description':'Airlines, hotels, cruise operators, tour professionals and logistics providers can apply to join the SARA VIA network. Every application is reviewed before integration is enabled.',
      'provider.legal':'Legal business name','provider.service':'Service category','provider.country':'Country code','provider.email':'Business contact email','provider.website':'Website (optional)','provider.details':'Describe your services','provider.submit':'Submit provider application'
    },
    ar: {
      'nav.discover':'اكتشف','nav.flights':'الرحلات الجوية','nav.hotels':'الفنادق','nav.cruises':'الرحلات البحرية','nav.experiences':'التجارب','nav.web3':'ويب 3','nav.partner':'كن شريكاً',
      'hero.eyebrow':'العالم بين يديك لتكتشفه','hero.title':'سافر بلا حدود.','hero.description':'منصة سفر ذكية تجمع الوجهات الاستثنائية والإقامات الفاخرة والتجارب المميزة وجيلاً جديداً من خدمات السفر عبر Web3.','hero.explore':'استكشف العالم','hero.web3':'اكتشف Web3',
      'search.kicker':'رحلتك تبدأ من هنا','search.title':'إلى أين تريد السفر؟','search.description':'ابحث في العالم من خلال تجربة سفر مميزة واحدة.',
      'search.from':'من','search.to':'إلى','search.date':'التاريخ','search.guests':'المسافرون','search.submit':'بحث',
      'provider.kicker':'كن شريكاً مع SARA VIA','provider.title':'قدّم خدماتك للمسافرين حول العالم.','provider.description':'يمكن لشركات الطيران والفنادق والرحلات البحرية ومنظمي الجولات ومزودي الخدمات اللوجستية التقدم للانضمام إلى شبكة SARA VIA. تخضع جميع الطلبات للمراجعة قبل تفعيل التكامل.',
      'provider.legal':'الاسم القانوني للشركة','provider.service':'فئة الخدمة','provider.country':'رمز الدولة','provider.email':'البريد الإلكتروني للتواصل','provider.website':'الموقع الإلكتروني (اختياري)','provider.details':'صف خدماتك','provider.submit':'إرسال طلب الشراكة'
    }
  };
  const selectors = {
    'nav.discover':'.main-nav a[href="#discover"]','nav.flights':'.main-nav a[href="#flights"]','nav.hotels':'.main-nav a[href="#stays"]','nav.cruises':'.main-nav a[href="#cruises"]','nav.experiences':'.main-nav a[href="#experiences"]','nav.web3':'.main-nav a[href="#web3"]','nav.partner':'.main-nav a[href="#providers"]',
    'hero.eyebrow':'.hero-eyebrow span:not(.eyebrow-line)','hero.title':'.hero-title','hero.description':'.hero-description','hero.explore':'.hero-actions a.primary-button span:first-child','hero.web3':'.hero-actions a.secondary-button',
    'search.kicker':'.search-heading .section-kicker','search.title':'.search-heading h2','search.description':'.search-heading p',
    'search.from':'label[for="departure"]','search.to':'label[for="destination"]','search.date':'label[for="travelDate"]','search.guests':'label[for="guests"]',
    'provider.kicker':'.provider-heading .section-kicker','provider.title':'.provider-heading h2','provider.description':'.provider-heading p',
    'provider.legal':'#providerApplicationForm label:nth-child(1)','provider.service':'#providerApplicationForm label:nth-child(2)','provider.country':'#providerApplicationForm label:nth-child(3)','provider.email':'#providerApplicationForm label:nth-child(4)','provider.website':'#providerApplicationForm label:nth-child(5)','provider.details':'#providerApplicationForm .provider-description'
  };
  function apply(language) {
    const lang = translations[language] ? language : 'en';
    const dictionary = translations[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    Object.entries(selectors).forEach(([key, selector]) => {
      const element = document.querySelector(selector);
      if (!element || !dictionary[key]) return;
      if (key === 'hero.title') {
        element.replaceChildren(document.createTextNode(lang === 'ar' ? dictionary[key] : 'Travel '));
        if (lang === 'en') { const span=document.createElement('span'); span.textContent='Beyond'; element.append(span,document.createTextNode(' Boundaries.')); }
      } else if (key.startsWith('provider.legal') || key.startsWith('provider.service') || key.startsWith('provider.country') || key.startsWith('provider.email') || key.startsWith('provider.website') || key.startsWith('provider.details')) {
        const control=element.querySelector('input,select,textarea');
        element.childNodes[0].textContent=dictionary[key]+' ';
        if (control && lang==='ar') control.dir='auto';
      } else if (key==='hero.explore') element.textContent=dictionary[key];
      else element.textContent=dictionary[key];
    });
    const submit=document.querySelector('#providerApplicationForm button[type="submit"]');
    if(submit) submit.firstChild.textContent=dictionary['provider.submit']+' ';
    const selector=document.querySelector('#languageSelector');
    if(selector) selector.value=lang;
    try { localStorage.setItem('sara-via-language',lang); } catch (_) {}
  }
  function init() {
    const selector=document.querySelector('#languageSelector');
    if(!selector) return;
    selector.addEventListener('change',()=>apply(selector.value));
    let saved='en';
    try { saved=localStorage.getItem('sara-via-language') || 'en'; } catch (_) {}
    apply(saved);
  }
  window.SaraViaI18n={init,apply};
})();