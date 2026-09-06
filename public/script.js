// ponytail: 原生 API，零相依。導覽列（滾動陰影＋手機選單）已移至共用 nav.js。
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold:0, rootMargin:'0px 0px 22% 0px'});
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
