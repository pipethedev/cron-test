const submitBtn = document.getElementById("submitBtn");
const spinner = document.getElementById("spinner");
const submitText = document.getElementById("submitText");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("errorMsg");

passwordInput.addEventListener("keydown", function(event) {
  if (event.keyCode === 13 || event.code === "Enter") {
    submitForm();
  }
});

function authorize() {
  spinner.classList.remove("hidden");

  const url = window.location.href;
  const withoutProtocol = url.replace(/^https?:\/\//, "");
  const withoutTrailingSlash = withoutProtocol.replace(/\/$/, "");
  const domain = withoutTrailingSlash.split("/")[0];

  const password = passwordInput.value;

  if (password === "") {
    passwordInput.classList.add("border-2");
    passwordInput.classList.add("border-rose-600");
    errorMessage.textContent = "This field is required.";
    errorMessage.style.display = "block";
  } else {
    submitBtn.disabled = true;

    submitText.textContent = "Processing...";

    passwordInput.classList.remove("border-2");
    passwordInput.classList.remove("border-rose-600");
    errorMessage.textContent = "";
    errorMessage.style.display = "none";

    const payload = { domain, password };

    axios
      .post(
        "https://api.brimble.io/v1/projects/password-protect/login",
        JSON.stringify(payload),
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
      .then(({ data }) => {
        document.cookie = `x-brimble-session=${data.data.token}`;

        setTimeout(() => {
          location.reload();
        }, 1000);
      })
      .catch((error) => {
        submitBtn.disabled = false;

        spinner.classList.add("hidden");

        submitText.textContent = "Continue";

        alert(error.response.data.message);
      });
  }
}