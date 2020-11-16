var swiper = new Swiper('.swiper-container1', {
  keyboard: true,
  virtualTranslate: true,
  on: {
    setTranslate: function() {
      this.$wrapperEl.transition('')
      TweenMax.to(this.$wrapperEl, 1.5, {
        x: this.translate,
        ease: Power4.easeOut
      })
    }
  },
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
});
/*厂房设备*/
var swiper = new Swiper('.swiper-container2', {
  slidesPerView: 1,
  spaceBetween: 1,
  // init: false,
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
    bulletClass: 'swiper-dot',
    bulletActiveClass: 'swiper-dot-active',
  },
  breakpoints: {
    '@0.00': {
      slidesPerView: 1,
      spaceBetween: 10,
    },
    '@0.75': {
      slidesPerView: 2,
      spaceBetween: 20,
    },
    '@1.00': {
      slidesPerView: 3,
      spaceBetween: 20,
    },
    '@1.50': {
      slidesPerView: 4,
      spaceBetween: 20,
    },
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
});
