// Injected into the Gmail tab with chrome.scripting.executeScript. Must be
// self-contained: it is serialised and runs in the page, not in the panel.
// Reads the newest expanded message in the open conversation (or the text the
// user has highlighted). Nothing here is sent anywhere by itself.
function debtjetExtractOpenGmailEmail() {
  const text = (el) => (el ? (el.innerText || el.textContent || "").trim() : "");
  const selection = (window.getSelection && window.getSelection().toString().trim()) || "";
  const subject = text(document.querySelector("h2.hP"));

  // Expanded messages in the conversation; the last one is the newest open message.
  const messages = Array.from(document.querySelectorAll("div.adn"));
  const msg = messages.length ? messages[messages.length - 1] : null;
  if (!msg) {
    return { found: false, subject, url: location.href };
  }

  const sender = msg.querySelector("span.gD[email]") || msg.querySelector("[email]");
  const dateEl = msg.querySelector("span.g3");
  const bodyEl = msg.querySelector("div.a3s");
  const idEl = msg.querySelector("[data-legacy-message-id]") || msg.closest("[data-legacy-message-id]");
  const msgIdEl = msg.querySelector("[data-message-id]") || msg.closest("[data-message-id]");

  return {
    found: true,
    subject,
    from_email: sender ? (sender.getAttribute("email") || "").trim() : "",
    from_name: sender ? (sender.getAttribute("name") || text(sender)) : "",
    date: dateEl ? (dateEl.getAttribute("title") || text(dateEl)) : "",
    body: selection || text(bodyEl),
    used_selection: !!selection,
    message_id: (idEl && idEl.getAttribute("data-legacy-message-id")) ||
                (msgIdEl && msgIdEl.getAttribute("data-message-id")) || "",
    url: location.href
  };
}
