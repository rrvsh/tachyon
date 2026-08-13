const openRouterApiUrl = "https://openrouter.ai/api/v1/chat/completions";

const composer = document.querySelector("#composer");
composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(composer);
  const response = await fetch(openRouterApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.get("openrouter_api_key")}`,
      "X-OpenRouter-Title": "Tachyon",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [
        {
          role: "user",
          content: data.get("prompt"),
        },
      ],
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    console.log(`Error: ${result.error.code} ${result.error.message}`);
  } else {
    console.log(result.choices[0].message.content);
  }
});
