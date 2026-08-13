(function () {
  var PASSWORD = "voirnd";
  var STORAGE_KEY = "riderSignalAuthed";

  if (localStorage.getItem(STORAGE_KEY) === "1") {
    document.body.classList.remove("locked");
    return;
  }

  var form = document.getElementById("password-gate__form");
  var input = document.getElementById("password-gate__input");

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (input.value === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "1");
      document.body.classList.remove("locked");
    } else {
      form.classList.add("password-gate--error");
      input.value = "";
      input.focus();
    }
  });
})();
