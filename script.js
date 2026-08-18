const openRouterApiUrl = "https://openrouter.ai/api/v1/chat/completions";

const composer = document.querySelector("#composer");
composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formKey = document.querySelector("#openrouter_api_key").value.trim();
  const prompt = document.querySelector("#prompt").value.trim();
  const output = document.querySelector("#output");
  const sendBtn = document.querySelector("#sendBtn");
  if (formKey) {
    localStorage.setItem("openrouter_api_key", formKey);
  }
  const key = formKey || localStorage.getItem("openrouter_api_key");
  if (!key) {
    alert(
      "OpenRouter API key not found; please enter it in the form before submitting.",
    );
    return;
  }
  sendBtn.textContent = "Sending...";
  sendBtn.disabled = true;
  output.textContent = "...";
  try {
    const response = await fetch(openRouterApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "X-OpenRouter-Title": "Tachyon",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      output.textContent = `Error: ${result.error.code} ${result.error.message}`;
    } else {
      output.textContent = result.choices[0].message.content;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.textContent = `Request failed: ${message}`;
    console.error(error);
  } finally {
    sendBtn.textContent = "Send";
    sendBtn.disabled = false;
  }
});
