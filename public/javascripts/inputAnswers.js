document.onkeyup = function(e) {
  if(e.keyCode >= 49 && e.keyCode <= 52) {
    var input = e.keyCode - 49;
    document.getElementById('answer' + input).checked = !document.getElementById('answer' + input).checked;
  } else if(e.keyCode === 13) {
    document.forms['answers'].submit();
  }
}