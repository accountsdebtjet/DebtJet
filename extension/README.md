# DebtJet for Gmail (Chrome extension)

Reads a debtor's email in Gmail, uses **Chrome's built-in Gemini Nano** (on-device AI) to pick out the key points, and files a short note against the right debtor and invoices in DebtJet.

The email itself never leaves the computer. Only the summary, the key points and the facts you approve are saved to DebtJet: the type, any promised date and amount, any dispute reason and a suggested next step.

## Requirements
- Chrome 138 or later on Windows 10/11, macOS 13+, Linux or a Chromebook Plus.
- To run Gemini Nano: 22 GB free disk space, and either a graphics card with more than 4 GB of memory or 16 GB of RAM. Without these, the extension still works, but you write the note yourself.

## Install (while in development)
1. Download the `extension` folder from this repo.
2. In Chrome, open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `extension` folder.
4. Pin **DebtJet for Gmail** to the toolbar.

## Use
1. Open a debtor's email in Gmail. To use only part of it, highlight that part first.
2. Click the DebtJet toolbar button. The side panel opens; sign in with your DebtJet login.
3. Click **Read this email**, then **Pick out key points**. The first time, Chrome downloads the AI model (a one-off of a few GB); keep the panel open until it finishes.
4. Check the debtor, the invoices (tick **disputed** on any the debtor disputes) and the summary, then click **Save to DebtJet**.

The note appears on the case in DebtJet under **Notes from email**. DebtJet uses it to warn you before you send a letter of demand, and its AI drafting uses it when it writes letters and statement notes.
