$(document).ready(function() {
  $(".side ul li").hover(function() {
    $(this).find(".sidebox").stop().animate({
      "width": "200px"
    }, 200).css({})
  }, function() {
    $(this).find(".sidebox").stop().animate({
      "width": "48px"
    }, 200).css({})
  });
});

function goTop() {
  $('html,body').animate({
    'scrollTop': 0
  }, 600);
}
$(function() {
  $(window).bind("scroll", function() {
    var sTop = $(window).scrollTop();
    var sTop = parseInt(sTop);
    if (sTop >= 130) {
      if (!$("#scrollSearchDiv").is(":visible")) {
        try {
          $("#scrollSearchDiv").slideDown();
        } catch (e) {
          $("#scrollSearchDiv").show();
        }
      }
    } else {
      if ($("#scrollSearchDiv").is(":visible")) {
        try {
          $("#scrollSearchDiv").slideUp();
        } catch (e) {
          $("#scrollSearchDiv").hide();
        }
      }
    }
  });
})
