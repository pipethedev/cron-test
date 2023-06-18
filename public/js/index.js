const submitBtn = document.getElementById("submitBtn");
const spinner = document.getElementById("spinner");
const submitText = document.getElementById("submitText");

function authorize() {
  submitBtn.disabled = true;

  spinner.classList.remove("hidden");

  submitText.textContent = "Processing...";

  const url = window.location.href;
  const withoutProtocol = url.replace(/^https?:\/\//, "");
  const withoutTrailingSlash = withoutProtocol.replace(/\/$/, "");
  const domain = withoutTrailingSlash.split("/")[0];

  const passwordInput = document.getElementById("password");
  const password = passwordInput.value;

  const payload = { domain, password };

  axios
    .post("https://api.brimble.io/v1/projects/password-protect/login", payload, {
      headers: { "Content-Type": "application/json" },
    })
    .then(({ data }) => {
      // tweak
      document.cookie = `x-brimble-session=${data.data.token}`;
      setTimeout(() => {
        location.reload();
      }, 2000);
    })
    .catch((error) => {
      submitBtn.disabled = false;

      spinner.classList.add("hidden");

      submitText.textContent = "Submit";

      alert(error.response.data.message);
    });
}
