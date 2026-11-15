# DebtJet for Google Workspace

```
Gmail add-on (Apps Script, on Google)
   │  email text
   ▼
debtjet-summarise (Cloud Run, Sydney, DebtJet's Google Cloud project, service account debtjet-gmail-ai — no keys)
   │
   ▼
Gemini 3.5 Flash Lite (Vertex AI / Agent Platform API)
   │  summary + key facts
   ▼
Staff member checks and edits in the add-on → only the summary is saved to DebtJet (Supabase case_notes)
```

The email itself never reaches DebtJet's own servers, and the summariser never logs email text.

---

## Part A: deploy the summariser (one-off, about 10 minutes)

1. In the Google Cloud console, check the project picker shows **DebtJet**, then click the **Cloud Shell** icon (`>_`, top right).
2. Paste the following commands into Cloud Shell. Replace `PASTE_ANON_KEY` with the public anon key (it's in `extension/config.js`):

```bash
gcloud config set project debtjet
git clone --depth 1 https://github.com/accountsdebtjet/DebtJet.git
cd DebtJet/google/summarise
gcloud run deploy debtjet-summarise \
  --source . \
  --region australia-southeast1 \
  --service-account debtjet-gmail-ai@debtjet.iam.gserviceaccount.com \
  --no-invoker-iam-check \
  --set-env-vars SUPABASE_ANON_KEY=PASTE_ANON_KEY,MODEL_ID=gemini-3.5-flash-lite,VERTEX_LOCATION=global \
  --memory 256Mi --max-instances 3
```

3. If it asks to enable APIs (Cloud Run, Cloud Build, Artifact Registry) or to create a repository, answer **Y**.
4. When it finishes, copy the **Service URL**. It looks like `https://debtjet-summarise-123456789012.australia-southeast1.run.app`.
5. Check it's running with this command. The expected reply is `{"ok":true,...}`. (Cloud Run reserves paths ending in "z", so `/healthz` returns a Google 404 page.)

```bash
curl https://YOUR-SERVICE-URL/health
```

**About `--no-invoker-iam-check`:** anyone can reach the URL, but the service refuses every request that doesn't carry a valid DebtJet login. New Google organisations block the older "allow unauthenticated" option, which is why this flag is used instead.

## Part B: install the Gmail add-on (for testing on your own account)

1. Go to <https://script.google.com>, click **New project**, and rename it **DebtJet Gmail add-on**.
2. Turn on the manifest file: click **Project Settings ⚙** and tick **Show "appsscript.json" manifest file in editor**.
3. Back in **Editor**, set up the files:
   - Replace the contents of `appsscript.json` with [google/gmail-addon/appsscript.json](gmail-addon/appsscript.json).
   - Rename `Code.gs` to `Cards.gs` and paste in [Cards.gs](gmail-addon/Cards.gs).
   - Add three more script files (**+ → Script**) named `Config`, `DebtJet` and `Match`, and paste in each matching file.
4. In `Config.gs`, set `SUMMARISE_URL` to the Service URL from Part A, then click **Save**.
5. Click **Deploy → Test deployments → Install → Done**.
6. Reload Gmail and open an email. The DebtJet icon appears in the right-hand side panel. Click it and approve the permissions. The add-on can only read the email you have open.
7. In DebtJet, go to **Integrations → Gmail add-on → Get connection code**, and type the code into the add-on.

## Before other businesses can install it (later)

- Move the Apps Script project onto the **DebtJet** Google Cloud project, then set up its OAuth consent screen and Google's verification.
- Add `urlFetchWhitelist` to the manifest with the Supabase URL and the Cloud Run URL.
- Publish the add-on to the Google Workspace Marketplace.
