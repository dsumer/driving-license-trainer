document.onkeyup = function(e) {
  if(e.keyCode === 13) {
    document.forms['answers'].submit();
  }
}