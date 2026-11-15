/**
 * DebtJet Gmail add-on — settings.
 *
 * SUMMARISE_URL: paste the URL Cloud Run shows after deploying google/summarise,
 * e.g. https://debtjet-summarise-123456789012.australia-southeast1.run.app
 */
var CONFIG = {
  SUMMARISE_URL: 'PASTE_CLOUD_RUN_URL_HERE',
  SUPABASE_URL: 'https://tuvfdqnuqglldpesweye.supabase.co',
  // Public (anon) key — designed to be public; data is protected by row-level security and the user's own login.
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dmZkcW51cWdsbGRwZXN3ZXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMTE2OTAsImV4cCI6MjEwOTg4NzY5MH0.3MU_ai1ig_DFLB-CdQD4q6RfAVyLy-Y-N7sYdgnuaio',
  APP_URL: 'https://accountsdebtjet.github.io/DebtJet/',
  MAX_BODY_CHARS: 20000
};

var CATEGORY_LABEL = {
  promise_to_pay: 'Promise to pay', payment_plan_request: 'Payment plan request', dispute: 'Dispute raised',
  payment_made: 'Says payment made', hardship: 'Hardship', reminder_ack: 'Acknowledged reminder',
  contact_change: 'Contact details changed', other: 'Other note'
};
