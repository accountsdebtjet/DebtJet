/* DebtJet: recovery.js
 * Debt Recovery: eligibility, claim, evidence pack, disputed facts, lodge and serve, outcome.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* =====================================================================
     DEBT RECOVERY (QLD QCAT and ACT ACAT live)
     DebtJet is software: it organises the business's own records and the
     tribunal's published steps. The business decides whether to apply,
     signs, lodges, serves and presents its own case.
     Rules are data so other states can be added without a rebuild.
     ===================================================================== */
  var RECOVERY_RULES = {
    QLD: { live: true, short: 'QCAT', forum: 'QCAT_MINOR_DEBT', tribunalOption: 'QCAT (Queensland)',
      bodyFull: 'Queensland Civil and Administrative Tribunal', kind: 'minor debt', claimLabel: 'Minor debt claim',
      forumName: 'Queensland Civil and Administrative Tribunal (QCAT): minor civil dispute, minor debt',
      limit: 25000, limitNote: 'including interest', limitOver: 'stop', limitScope: 'QCAT minor debt claims', overText: 'QCAT can’t hear it as a minor debt. Claims up to $150,000 go to the Magistrates Court of Queensland, and claims from $150,001 to $750,000 to the District Court.', largerLink: 'https://www.courts.qld.gov.au/types-of-cases/money-disputes/about-money-disputes',
      form: 'Form 3: Application for minor civil dispute (minor debt)', copyTarget: 'QCase or Form 3',
      lodge: 'Online through QCase (Brisbane), or lodge Form 3 at a QCAT or Magistrates Court registry, and pay the filing fee when you lodge.',
      fileLabel: 'QCAT file number', filePh: 'e.g. MCDO1234/26',
      tribunalServes: false, responseDays: 28, responseNote: 'Their response is due 28 days after they are served.',
      serveIntro: 'After lodging you must give a copy of the application to the respondent, following QCAT’s rules on service (for example by post). Their response is due 28 days after they are served.',
      hearingLabel: 'Hearing or mediation', limitationYears: 6,
      resolveFirst: 'QCAT asks you to try to resolve the dispute with the other party first, for example by writing to them.',
      noResponse: 'No response by the due date. Check QCAT’s guidance on asking for a decision.',
      decided: 'Record whether the order is paid. If it isn’t, check QCAT’s guidance on enforcing an order.',
      fees: [{ upTo: 1000, fee: 96.30 }, { upTo: 10000, fee: 164.30 }, { upTo: 25000, fee: 405.60 }], feesFrom: '1 July 2026',
      recoverable: 'the filing fee, the bailiff or process server fee for serving the application, and a business name or company search fee',
      checked: '2026-11-17',
      links: {
        guide: 'https://www.qcat.qld.gov.au/case-types/debt-disputes/debt-dispute-process/application-for-minor-civil-dispute-minor-debt/application-for-minor-civil-dispute-minor-debt/application-for-minor-civil-dispute-minor-debt',
        form: 'https://www.qcat.qld.gov.au/__data/assets/pdf_file/0019/100855/form-03-app-mcd-minor-debt-dispute.pdf',
        fees: 'https://www.qcat.qld.gov.au/resources/fees-and-allowances',
        help: 'https://legalaid.qld.gov.au/Find-legal-information/Publications-and-resources/Legal-information-guides/Does-someone-owe-you-money-a-guide-to-help-you-claim-a-minor-debt'
      }, applyLabel: 'QCAT: how to apply', formLabel: 'Form 3 (PDF)', helpLabel: 'Legal Aid QLD minor debt guide',
      checks: function(c, cl, add, d){
        if(d.state && String(d.state).toUpperCase() !== 'QLD') add('info', 'Respondent is in ' + String(d.state).toUpperCase(), 'QCAT says you can still make a minor debt application if the respondent is interstate.');
      },
      extraEvidence: function(){ return []; } },
    ACT: { live: true, short: 'ACAT', forum: 'ACAT_CIVIL_DEBT', tribunalOption: 'ACAT (ACT)',
      overText: 'Claims between $25,001 and $250,000 go to the ACT Magistrates Court; claims over $250,000 go to the Supreme Court.', largerLink: 'https://www.courts.act.gov.au/magistrates/about-the-courts/areas-in-the-act-magistrates-court/civil-jurisdiction',
      bodyFull: 'ACT Civil and Administrative Tribunal', kind: 'civil dispute (debt)', claimLabel: 'Debt application',
      forumName: 'ACT Civil and Administrative Tribunal (ACAT): civil dispute, debt application',
      limit: 25000, limitNote: 'the amount claimed', limitOver: 'abandon',
      form: 'Civil Dispute Application (debt application)', copyTarget: 'ACAT Online Forms or the hard-copy Civil Dispute Application',
      lodge: 'Online through ACAT Online Forms (you need an Online Forms account and Google Chrome), or on the hard-copy form with one copy for each party plus one for ACAT. Pay the fee when you lodge.',
      fileLabel: 'ACAT file number', filePh: 'e.g. XD1234/2026',
      tribunalServes: true, responseDays: 21, responseNote: 'The response is due by the date in ACAT’s letter, usually 21 days.',
      serveIntro: 'ACAT serves the application on the respondent by prepaid post unless you told ACAT you would serve it yourself (if you serve it personally, an affidavit of service is needed). Record the service date and the response date from ACAT’s letter. The case is then listed for a directions hearing, which both parties must attend.',
      hearingLabel: 'Directions hearing, conference or hearing', limitationYears: 6,
      resolveFirst: 'ACAT recommends trying to resolve the dispute by negotiation or mediation first, and asks you to attach any letter of demand to your application.',
      noResponse: 'No response by the due date. ACAT says judgment may be entered if the respondent doesn’t respond in time: check ACAT’s guidance and its Application for Default Judgment – Civil Dispute form.',
      decided: 'Record whether the order is paid. If it isn’t, check ACAT’s guidance on enforcing orders.',
      entityFees: true,
      fees: { corporation: [{ upTo: 3000, fee: 185 }, { upTo: 15000, fee: 392 }, { upTo: Infinity, fee: 1415 }],
              person: [{ upTo: 3000, fee: 93 }, { upTo: 15000, fee: 195 }, { upTo: Infinity, fee: 707 }] }, feesFrom: '1 July 2026',
      recoverable: null, checked: '2026-11-18',
      links: {
        guide: 'https://www.acat.act.gov.au/case-types/civil-disputes',
        form: 'https://www.acat.act.gov.au/fees-and-forms/online-forms/civil-dispute-application-form',
        fees: 'https://www.acat.act.gov.au/fees-and-forms/acat-fees',
        help: 'https://actlawsociety.asn.au/for-the-public/fact-sheets/somebody-owes-me-money'
      }, applyLabel: 'ACAT: civil disputes', formLabel: 'Civil dispute application (online)', helpLabel: 'ACT Law Society: somebody owes me money',
      checks: function(c, cl, add, d, entity){
        var st = String(d.state || '').toUpperCase();
        if(st && st !== 'ACT') add('caution', 'Respondent is in ' + st, 'ACAT can usually hear the claim only if the respondent is an ACT resident when the application is served, or a material part of the claim happened in the ACT.');
        else if(st === 'ACT') add('ok', 'Respondent is in the ACT', 'ACAT can hear a claim against a respondent who is an ACT resident when served.');
        if(cl.interest > 0) add('info', 'Show how interest is calculated', 'Use ACAT’s interest calculator or its Statement of interest claimed form. If you claim interest under your contract, include a copy of the contract.');
        if(entity !== 'person') add('info', 'Lodging for a company', 'If someone other than a lawyer (for example a director or employee) lodges for your company, ACAT needs an Authority to act for a corporation form and an ASIC extract for your company.');
        add('info', 'Hearings are usually public', 'ACAT hearings are usually open to the public, and information you give ACAT may be publicly available.');
      },
      extraEvidence: function(cl, entity){
        var out = [];
        if(cl.interest > 0) out.push(['interest_stmt', 'Statement of interest claimed (ACAT form) or a printout of ACAT’s interest calculator']);
        if(entity !== 'person') out.push(['authority', 'Authority to act for a corporation and an ASIC extract for your company (if a non-lawyer lodges)']);
        return out;
      } },
    NSW: { live: true, short: 'Local Court', theShort: 'the Local Court', forum: 'NSW_LC_SMALL_CLAIMS', tribunalOption: 'Local Court of NSW (Small Claims)',
      bodyFull: 'Local Court of New South Wales', kind: 'Small Claims Division', claimLabel: 'Statement of claim', docNoun: 'statement of claim',
      forumName: 'Local Court of NSW, Small Claims Division (statement of claim for a debt)',
      terms: ['plaintiff', 'defendant'],
      limit: 20000, limitNote: 'the amount claimed', limitOver: 'stop', limitScope: 'the Local Court’s Small Claims Division',
      overText: 'Claims over $20,000 and up to $100,000 go to the Local Court’s General Division, which is more formal. Claims over $100,000 go to the District Court or the Supreme Court.',
      form: 'Statement of Claim (Local Court, Small Claims Division)', copyTarget: 'the NSW Online Registry or the Statement of Claim form',
      lodge: 'File the Statement of Claim online through the NSW Online Registry, or at a Local Court registry (the original plus one copy), and pay the filing fee. If you want the court to post it to the defendant, pay the service fee when you file.',
      fileLabel: 'Case number', filePh: 'e.g. 2026/00123456',
      tribunalServes: false, courtPost: 'Posted by the Local Court', serveWithinMonths: 6,
      responseDays: 28, responseNote: 'The defendant has 28 days after being served to pay or file a defence.',
      serveIntro: 'A statement of claim for a debt must be served within 6 months of filing. You can serve it yourself, ask someone else to, pay a process server, or pay the Local Court to post it. A company can be served by post to its registered office. Unless the court posted it, the person who served it completes an affidavit of service. If the court posted it, check with the court which date it counts as served.',
      hearingLabel: 'Pre-trial review or hearing', limitationYears: 6,
      resolveFirst: 'Try to resolve the debt before going to court, for example with a letter of demand.',
      noResponse: 'No defence or payment within 28 days of service. You can apply for default judgment (Form 38 Notice of motion – default judgment for liquidated claim, with an affidavit of service unless the court posted it). Apply within 9 months of filing the statement of claim.',
      decided: 'Record whether the judgment is paid. If it isn’t, check the Local Court’s guidance on enforcing a judgment (judgments can be enforced for 12 years).',
      entityFees: true,
      fees: { corporation: [{ upTo: Infinity, fee: 358 }], person: [{ upTo: Infinity, fee: 179 }] }, feesFrom: '1 July 2026',
      feeNote: 'Add $56 for each address if the court posts the statement of claim. A default judgment application (notice of motion) costs $114, or $228 for a company.',
      recoverable: 'the filing fee and service fee, which you can include on the statement of claim', checked: '2026-11-20',
      links: {
        guide: 'https://www.legalaid.nsw.gov.au/my-problem-is-about/my-money/making-a-claim/going-to-court',
        form: 'https://www.legalaid.nsw.gov.au/my-problem-is-about/my-money/making-a-claim/step-by-step-guide-preparing-a-statement-of-claim',
        fees: 'https://localcourt.nsw.gov.au/locations--lists-and-forms/forms-and-fees/fees.html',
        help: 'https://www.legalaid.nsw.gov.au/my-problem-is-about/my-money/making-a-claim/step-by-step-guide-serving-a-statement-of-claim'
      }, applyLabel: 'Legal Aid NSW: going to court', formLabel: 'Legal Aid NSW: preparing a statement of claim', helpLabel: 'Legal Aid NSW: serving a statement of claim',
      checks: function(c, cl, add, d){
        var st = String(d.state || '').toUpperCase();
        if(st && st !== 'NSW') add('info', 'Defendant is in ' + st, 'Serving outside NSW needs the interstate service notice under the Service and Execution of Process Act 1992 attached to the statement of claim (Legal Aid NSW has a sample).');
        if(cl.interest > 0) add('info', 'Interest on the claim', 'If your terms don’t set an interest rate, the Local Court publishes its pre-judgment interest rates on its website.');
        add('info', 'Costs are limited', 'The Small Claims Division limits the costs the winning party can claim. Lawyers’ costs are capped.');
      },
      extraEvidence: function(){ return [['affidavit_service', 'Affidavit of service (not needed if the Local Court posted the statement of claim)']]; } },
    VIC: { live: true, short: 'Magistrates’ Court', theShort: 'the Magistrates’ Court', forum: 'VIC_MC_COMPLAINT', tribunalOption: 'Magistrates’ Court of Victoria',
      bodyFull: 'Magistrates’ Court of Victoria', kind: 'civil complaint', claimLabel: 'Complaint', docNoun: 'complaint',
      forumName: 'Magistrates’ Court of Victoria: civil complaint for a debt (Form 5A)',
      terms: ['plaintiff', 'defendant'],
      limit: 100000, limitNote: 'the amount claimed', limitOver: 'stop', limitScope: 'the Magistrates’ Court',
      overText: 'Claims over $100,000 go to the County Court.',
      form: 'Complaint (Form 5A) with a statement of claim', copyTarget: 'the courts’ online filing portal or Form 5A',
      lodge: 'File the complaint online through the courts’ portal, or file the original and two copies at the Magistrates’ Court closest to where the matter arose or to the defendant’s address. You also file the Form 4A overarching obligations certification, and pay the filing fee.',
      fileLabel: 'Case number', filePh: 'e.g. M12345678',
      tribunalServes: false, serveWithinMonths: 12,
      responseDays: 21, responseNote: 'The defendant has 21 days after being served to pay or file a notice of defence (Form 8A).',
      serveIntro: 'Serve a copy of the complaint and two blank copies of the notice of defence (Form 8A) on the defendant. The complaint is valid for service for 12 months from filing. A company is served at its registered office (check ASIC). The person who serves it completes an affidavit of service (Form 6A). A defendant outside Victoria needs the interstate notice to defendant attached.',
      hearingLabel: 'Arbitration, conference or hearing', limitationYears: 6,
      resolveFirst: 'Before you file, take reasonable steps to resolve the dispute, such as sending a letter of demand. Victoria’s Civil Procedure Act expects parties to try to resolve a dispute first.',
      noResponse: 'No notice of defence within 21 days of service. You can apply for an order in default of defence (Form 21A), with the affidavit of service.',
      decided: 'Record whether the order is paid. If it isn’t, check the Magistrates’ Court’s guidance on enforcing a civil order.',
      entityFees: true,
      fees: { corporation: [{ upTo: 1000, fee: 352.30 }, { upTo: 10000, fee: 735.70 }, { upTo: 40000, fee: 1119.10 }, { upTo: Infinity, fee: 1678.60 }],
              person: [{ upTo: 1000, fee: 176.20 }, { upTo: 10000, fee: 367.90 }, { upTo: 40000, fee: 559.50 }, { upTo: Infinity, fee: 839.30 }] }, feesFrom: '1 July 2026',
      feeNote: 'Calculated from the fee units in the Magistrates’ Court (Fees) Regulations 2022 at $17.27 a fee unit. Businesses with a turnover of $200,000 or less in the last financial year can pay the standard (lower) fee by completing the court’s fee payer statement.',
      recoverable: 'the filing fee and the scale costs you can claim on the complaint', checked: '2026-11-20',
      links: {
        guide: 'https://www.mcv.vic.gov.au/civil-matters/starting-civil-matter',
        form: 'https://www.mcv.vic.gov.au/sites/default/files/2023-04/Form%205A%20-%20Complaint.pdf',
        fees: 'https://www.mcv.vic.gov.au/sites/default/files/2026-06/Court%20Fees%20and%20Costs%20Ready%20Reckoner%20-%201%20July%202026.pdf',
        help: 'https://courts.vic.gov.au/node/18071'
      }, applyLabel: 'Magistrates’ Court: starting a civil matter', formLabel: 'Form 5A Complaint (PDF)', helpLabel: 'Courts portal: filing a complaint online',
      forumChoices: [['VIC_MC_COMPLAINT', 'Magistrates’ Court'], ['VCAT_CIVIL_CLAIMS', 'VCAT (goods and services)']],
      alts: { VCAT_CIVIL_CLAIMS: { live: true, short: 'VCAT', forum: 'VCAT_CIVIL_CLAIMS', tribunalOption: 'VCAT (Victoria)',
        bodyFull: 'Victorian Civil and Administrative Tribunal', kind: 'Civil Claims List', claimLabel: 'Application',
        forumName: 'Victorian Civil and Administrative Tribunal (VCAT): Civil Claims List, goods and services dispute',
        limit: Infinity, limitNote: 'the amount claimed', limitOver: 'stop', limitScope: 'VCAT',
        form: 'Goods and services application (Civil Claims List) with points of claim', copyTarget: 'myVCAT or VCAT’s print-friendly application form',
        lodge: 'Apply online through myVCAT (or use VCAT’s print-friendly form) and pay the application fee when you submit it. Set out how the purchase happened, what was supplied, what is unpaid and the order you want (payment of the amount owed).',
        fileLabel: 'VCAT reference number', filePh: 'e.g. C1234/2026',
        tribunalServes: false, responseDays: null, responseNote: 'VCAT’s notice sets the dates for any response, mediation or hearing.',
        serveIntro: 'After you apply, send a copy of the application to the respondent. VCAT says your case will not progress until you do. Then complete a declaration of service (you can upload it in myVCAT). A respondent outside Victoria also needs Form 4 under the Service and Execution of Process Regulations. Enter any response date from VCAT’s notice.',
        hearingLabel: 'Mediation or hearing', limitationYears: 6,
        resolveFirst: 'Try to resolve the dispute first, for example with a letter of demand that gives a set time to pay.',
        noResponse: 'No response from the respondent. Attend the mediation or hearing listed in VCAT’s notice: VCAT can still decide the claim.',
        decided: 'Record whether the order is paid. If it isn’t, a VCAT order for payment of money can be enforced through the Magistrates’ Court.',
        entityFees: true,
        fees: { corporation: [{ upTo: 15000, fee: 202.10 }, { upTo: Infinity, fee: 673.50 }], person: [{ upTo: 15000, fee: 67.40 }, { upTo: Infinity, fee: 222.80 }] }, feesFrom: '1 July 2026',
        feeNote: 'Businesses with a turnover under $300,000 in the last financial year can pay the standard fee by giving VCAT a statutory declaration. Hearing fees apply only to claims over $15,000.',
        recoverable: null, checked: '2026-11-20',
        links: {
          guide: 'https://www.vcat.vic.gov.au/case-types/goods-and-services/apply-goods-and-services',
          form: 'https://www.vcat.vic.gov.au/case-types/goods-and-services/apply-goods-and-services/application-checklist',
          fees: 'https://www.vcat.vic.gov.au/fees',
          help: 'https://www.vcat.vic.gov.au/case-types/goods-and-services/after-you-apply-goods-and-services-disputes'
        }, applyLabel: 'VCAT: before you apply', formLabel: 'VCAT: application checklist (myVCAT)', helpLabel: 'VCAT: after you apply',
        checks: function(c, cl, add, d){
          var st = String(d.state || '').toUpperCase();
          add('caution', 'Only for goods or services you supplied', 'VCAT’s Civil Claims List hears disputes between a supplier and a purchaser about goods or services. For loans or other kinds of debt, use the Magistrates’ Court.');
          add('info', 'Expect a wait', 'VCAT says to expect around 52 weeks from applying to a mediation or hearing. Claims up to $10,000 may be offered fast-track mediation.');
          add('info', 'You present your own case', 'For goods and services claims under $15,000, VCAT generally doesn’t allow a lawyer or other professional representative to speak for you.');
          if(st && st !== 'VIC') add('info', 'Respondent is in ' + st, 'Serving outside Victoria needs Form 4 under the Service and Execution of Process Regulations 2018 with the application.');
        },
        extraEvidence: function(){ return [['points_claim', 'Points of claim: the facts in numbered paragraphs, in date order'], ['declaration_service', 'Declaration of service (upload in myVCAT)']]; } } },
      checks: function(c, cl, add, d){
        var st = String(d.state || '').toUpperCase();
        if(st && st !== 'VIC') add('info', 'Defendant is in ' + st, 'Serving outside Victoria needs the interstate notice to defendant (under the Service and Execution of Process Act 1992) attached to the complaint.');
        add('info', 'Your address for service', 'If you sue without a lawyer, the address for service you put on the complaint must be in Victoria.');
        if(cl.total < 10000) add('info', 'Claims under $10,000 usually go to arbitration', 'If the defendant files a defence, a claim under $10,000 is usually decided at arbitration, a less formal hearing.');
      },
      extraEvidence: function(){ return [['form4a', 'Form 4A overarching obligations certification (filed with the complaint)'], ['affidavit_service', 'Affidavit of service (Form 6A) from whoever served the complaint']]; } },
    WA: { live: true, short: 'Magistrates Court', theShort: 'the Magistrates Court', forum: 'WA_MC_MINOR_CASE', tribunalOption: 'Magistrates Court of WA (Minor Case)',
      bodyFull: 'Magistrates Court of Western Australia', kind: 'minor case claim', claimLabel: 'Minor case claim', docNoun: 'minor case claim',
      forumName: 'Magistrates Court of Western Australia: minor case claim (Form 4)',
      terms: ['claimant', 'defendant'], verb: 'lodge',
      limit: 10000, limitNote: 'the amount claimed', limitOver: 'stop', limitScope: 'minor case claims in the WA Magistrates Court',
      overText: 'Claims over $10,000 and up to $75,000 can be made as a general procedure claim in the Magistrates Court. Claims over $75,000 go to the District Court.',
      form: 'Form 4 – Minor Case Claim', copyTarget: 'the eCourts Portal (Form 4)',
      lodge: 'Lodge Form 4 – Minor Case Claim electronically through the eCourts Portal, choose the court registry and pay the fee. The defendant’s address must be a residential address, or the registered office for a company. A small business or non-profit association can lodge a declaration to pay the lower fee.',
      fileLabel: 'Case number', filePh: 'As shown in eCourts',
      tribunalServes: false, courtPost: 'Served by a court bailiff',
      responseDays: 14, responseDaysFor: function(d){ var st = String(d.state || '').toUpperCase(); return st && st !== 'WA' ? 21 : 14; },
      responseNote: 'The defendant has 14 days after being served in WA (21 days if served in another state or territory) to respond.',
      serveIntro: 'In most cases the claim must be served personally on the defendant. You can pre-pay the court to have a bailiff serve it, or serve it yourself following the court’s guidance on serving court documents. You can’t take further steps until the defendant’s time to respond has passed.',
      hearingLabel: 'Pre-trial conference, status conference or trial', limitationYears: 6,
      resolveFirst: 'Try to resolve the debt before making a claim, for example with a letter of demand.',
      noResponse: 'No response by the deadline. Lodge proof of service and an application for default judgment through the eCourts Portal.',
      decided: 'Record whether the judgment is paid. If it isn’t, check the Magistrates Court’s guidance on enforcing a judgment.',
      entityFees: true,
      fees: { corporation: [{ upTo: Infinity, fee: 381.00 }], person: [{ upTo: Infinity, fee: 196.50 }] }, feesFrom: '3 September 2026',
      feeNote: 'Small businesses and non-profit associations pay the lower fee by lodging a declaration (Form 1). Bailiff service is $117.50 plus travel. Lawyers’ costs generally aren’t recoverable in claims of $10,000 or less.',
      recoverable: null, checked: '2026-11-20',
      links: {
        guide: 'https://www.smallbusiness.wa.gov.au/templates-tools-guides/guides/recovering-debt-through-magistrates-court',
        form: 'https://magistratescourt.wa.gov.au/_files/Civil_factsheet_3.pdf',
        fees: 'https://www.magistratescourt.wa.gov.au/_files/magistrates_court_fees.pdf',
        help: 'https://ecourts.justice.wa.gov.au/eCourtsPortal/'
      }, applyLabel: 'Small Business Development Corporation: recovering debt', formLabel: 'Fact Sheet 3: minor case claim (PDF)', helpLabel: 'eCourts Portal',
      checks: function(c, cl, add, d){
        var st = String(d.state || '').toUpperCase();
        if(st && st !== 'WA') add('info', 'Defendant is in ' + st, 'If served in another state or territory, the defendant has 21 days (not 14) to respond.');
        add('info', 'Minor case or general procedure', 'For $10,000 or less you can choose a minor case claim or a general procedure claim. In a minor case, parties can’t be represented by a lawyer unless everyone agrees or the court allows it.');
        add('info', 'Proceedings are private', 'Minor case proceedings are private unless the court orders otherwise.');
      },
      extraEvidence: function(cl, entity){ var out = [['proof_service', 'Proof of service (needed to apply for default judgment)']]; if(entity !== 'person') out.push(['sb_declaration', 'Small business or non-profit declaration (Form 1), if you’re paying the lower fee']); return out; } },
    SA: { live: true, short: 'Magistrates Court', theShort: 'the Magistrates Court', forum: 'SA_MC_MINOR_CIVIL', tribunalOption: 'Magistrates Court of SA (Minor Civil)',
      bodyFull: 'Magistrates Court of South Australia', kind: 'minor civil claim', claimLabel: 'Claim',
      forumName: 'Magistrates Court of South Australia: minor civil claim (Claim, Form 1)',
      limit: 12000, limitNote: 'the amount claimed', limitOver: 'stop', limitScope: 'minor civil claims in the SA Magistrates Court',
      overText: 'Claims from $12,001 to $100,000 go to the Magistrates Court’s Civil (General Claims) Division, which is more formal and has its own pre-action steps. Claims over $100,000 go to the District Court or the Supreme Court.', largerLink: 'https://www.courts.sa.gov.au/?p=9209',
      form: 'Claim (Form 1), lodged through the CourtSA portal', copyTarget: 'the CourtSA portal',
      lodge: 'Lodge the Claim (Form 1) electronically through the CourtSA portal and pay by card (cash and cheques aren’t accepted). Choose the first hearing location, ideally the court closest to where the claim arose or where the respondent lives, and include a short summary of the claim (under 100 words for claims up to $12,000). CourtSA gives the case a CIV number.',
      fileLabel: 'CIV number', filePh: 'As shown in CourtSA',
      tribunalServes: false, courtPost: 'Served by a sheriff’s officer',
      responseDays: 28, responseNote: 'The respondent has 28 days after being served (within Australia) to respond.',
      serveIntro: 'You choose how to serve when you lodge in CourtSA: serve it yourself by post, email or in person (no fee), have a lawyer serve it, or pay for a sheriff’s officer. If you serve it yourself, you’ll need an affidavit of proof of service to ask for default judgment.',
      hearingLabel: 'Directions hearing, settlement conference or trial', limitationYears: 6,
      resolveFirst: 'Before you file, give the respondent a Final Notice (Form P1) or a letter of demand that meets the court rules, and wait 21 days.',
      noResponse: 'No response after 28 days. Request default judgment in CourtSA. If you served the claim yourself, provide an affidavit of proof of service. Judgment isn’t entered automatically.',
      decided: 'Record whether the judgment is paid. If it isn’t, check the Magistrates Court’s guidance on enforcing a judgment.',
      entityFees: false,
      fees: [{ upTo: Infinity, fee: 186 }], feesFrom: '1 July 2026',
      feeNote: 'A Final Notice through CourtSA costs $27.75 ($66.50 through a registry). Your own compliant letter of demand has no court fee. Sheriff’s service is extra.',
      recoverable: 'the filing fee and the final notice fee, provided you gave a pre-action notice and waited 21 days', checked: '2026-11-20',
      links: {
        guide: 'https://www.courts.sa.gov.au/civil-cases/before-making-a-claim/',
        form: 'https://www.courts.sa.gov.au/?p=9209',
        fees: 'https://www.courts.sa.gov.au/rules-forms-fees/fees/magcourt-civil-genminor-fees/',
        help: 'https://lawhandbook.sa.gov.au/ch14s02s05.php'
      }, applyLabel: 'Courts SA: before making a claim', formLabel: 'Courts SA: lodging and serving a claim', helpLabel: 'Law Handbook SA: starting a minor civil claim',
      checks: function(c, cl, add, d){
        var dd = demandDates[c.id] || {}, last = dd.final || dd.first;
        if(!last) add('caution', 'Pre-action notice needed', 'Give a Final Notice (Form P1, generated in CourtSA) or a letter of demand that meets the Uniform Civil Rules’ pre-action requirements, then wait 21 days. Without it, you can’t recover the cost of filing the claim. Letters of Demand has an “SA pre-action notice” template.');
        else {
          var ready = addDaysIso(String(last).slice(0, 10), 21);
          if(daysUntil(ready) > 0) add('caution', 'Wait 21 days after your notice', 'Your last demand was sent ' + fmt(last) + '. You can file from ' + fmt(ready) + '. Filing earlier may stop you recovering your costs.');
          else add('ok', '21 days have passed since your notice', 'A letter of demand only counts as a pre-action notice if it includes what the Uniform Civil Rules require (Letters of Demand has an “SA pre-action notice” template). A CourtSA Final Notice always does.');
        }
        add('info', 'You present your own case', 'Parties in minor civil claims aren’t entitled to a lawyer except in special circumstances.');
        add('info', 'Directions hearing', 'If the respondent files a defence, a directions hearing is usually listed about six weeks later. Both parties must attend.');
      },
      extraEvidence: function(){ return [['final_notice', 'Final Notice (Form P1) or compliant letter of demand, and proof it was given at least 21 days before filing'], ['proof_service', 'Affidavit of proof of service (if you served the claim yourself)']]; } },
    TAS: { live: true, short: 'Magistrates Court', theShort: 'the Magistrates Court', forum: 'TAS_MC_MINOR_CIVIL', tribunalOption: 'Magistrates Court of Tasmania (Minor Civil)',
      bodyFull: 'Magistrates Court of Tasmania (Civil Division)', kind: 'minor civil claim', claimLabel: 'Claim', docNoun: 'claim',
      forumName: 'Magistrates Court of Tasmania: minor civil claim (Form 1 – Claim)',
      terms: ['claimant', 'defendant'],
      limit: 15000, limitNote: 'the amount claimed', limitOver: 'stop', limitScope: 'minor civil claims in the Tasmanian Magistrates Court',
      overText: 'Claims over $15,000 and up to $50,000 can be made as a civil claim in the Magistrates Court. Claims over $50,000 go to the Supreme Court.',
      form: 'Form 1 – Claim and Notice to Defendant', copyTarget: 'Form 1 – Claim',
      lodge: 'Complete Form 1 – Claim and Notice to Defendant and lodge it at a Magistrates Court registry with the filing fee. Bring enough copies: one for the court, one for you, and one for each defendant. The registry seals the claim and gives it an action number.',
      fileLabel: 'Action number', filePh: 'As shown on the sealed claim',
      tribunalServes: false, courtPost: 'Served by the court',
      serveWithinMonths: 12,
      responseDays: 21, responseNote: 'The defendant has 21 days after receiving the claim to pay, admit it or file a defence.',
      serveIntro: 'Serve the sealed Claim and Notice to Defendant on each defendant within one year of lodging, either in person (by you or anyone over 18) or by registered post. The court can also arrange service. If it’s served in person, complete the affidavit of service on the claim form.',
      hearingLabel: 'Conciliation conference or hearing', limitationYears: 6,
      resolveFirst: 'Try to resolve the debt before making a claim, for example with a letter of demand.',
      noResponse: 'No defence after 21 days. File a default judgment form at the registry, attaching your original claim and the affidavit of service.',
      decided: 'Record whether the judgment is paid. If it isn’t, check the Magistrates Court’s guidance on enforcement, such as a warrant or garnishee order.',
      entityFees: false,
      fees: [{ upTo: 5000, fee: 147.00 }, { upTo: Infinity, fee: 284.20 }], feesFrom: '1 July 2026',
      feeNote: 'Fees include the $9.80 Appeal Costs Fund levy. If you win, the court’s scale lets you claim filing and service costs on judgment.',
      recoverable: null, checked: '2026-11-20',
      links: {
        guide: 'https://www.magistratescourt.tas.gov.au/going_to_court/civil_disputes',
        form: 'https://www.magistratescourt.tas.gov.au/about_us/civil/minor_civil_claims/minor_civil_claim_flowchart',
        fees: 'https://www.magistratescourt.tas.gov.au/__data/assets/pdf_file/0009/899064/2026-No-1-Fees-Annual-Increase-and-Civil-Division-Ready-Reckoner-effective-1-July-2026.pdf',
        help: 'https://www.legalaid.tas.gov.au/civil-claims'
      }, applyLabel: 'Magistrates Court of Tasmania: civil disputes', formLabel: 'Minor civil claim flowchart', helpLabel: 'Legal Aid Tasmania: civil claims and forms',
      checks: function(c, cl, add, d){
        if(cl.total > 5000) add('caution', 'Confirm the claim stream with the registry', 'The Minor Civil Claims Regulations 2023 set the minor civil claim limit at $15,000, but parts of the court’s website still say $5,000. Confirm with the registry that your claim will be treated as a minor civil claim (conciliation conference) rather than a civil claim (directions hearing).');
        add('info', 'If the defendant files a defence', 'A minor civil claim usually goes to a conciliation conference first. If it doesn’t settle, it goes to a hearing before a magistrate.');
      },
      extraEvidence: function(){ return [['proof_service', 'Affidavit of service (needed for default judgment if served in person)'], ['registered_post', 'Registered post receipt and tracking (if served by post)']]; } },
    NT: { live: true, short: 'NTCAT', forum: 'NTCAT_SMALL_CLAIM', tribunalOption: 'NTCAT (Northern Territory)',
      bodyFull: 'Northern Territory Civil and Administrative Tribunal', kind: 'small claim', claimLabel: 'Small claim',
      forumName: 'Northern Territory Civil and Administrative Tribunal (NTCAT): small claim (Small Claims Act 2016)',
      limit: 25000, limitNote: 'the amount claimed', limitOver: 'stop', limitScope: 'NTCAT small claims',
      overText: 'Claims between $25,001 and $250,000 go to the Local Court. Claims over $250,000 go to the Supreme Court.',
      form: 'Form 1 Initiating Application (small claim)', copyTarget: 'NTCAT’s Form 1 Initiating Application',
      lodge: 'File the Form 1 Initiating Application with NTCAT and pay the fee. NTCAT won’t process the application until the fee is paid. NTCAT seals the Form 1 and returns it to you, usually with standard orders.',
      fileLabel: 'NTCAT file number', filePh: 'As shown on the sealed Form 1',
      tribunalServes: false, responseDays: null, responseNote: 'The response is due by the date in NTCAT’s standard orders.',
      serveIntro: 'You must serve both the sealed Form 1 Initiating Application and NTCAT’s standard orders on the respondent, following NTCAT’s Service Guidelines. The proceeding won’t continue until the respondent has been served, and you may need to prove how you served them. Enter the response date from NTCAT’s orders.',
      hearingLabel: 'Conference or hearing', limitationYears: 3,
      resolveFirst: 'NT Government guidance suggests contacting the debtor and sending a letter of demand that gives a reasonable time to pay (it suggests within 28 days) before making a claim.',
      noResponse: 'No response by the due date. NTCAT can list a debt claim for a default decision: you file a Form 7 Unattested Declaration (Default Decision) 7 days before the hearing, with proof of service.',
      decided: 'Record whether the order is paid. If it isn’t, check NTCAT’s guidance on enforcing a decision.',
      entityFees: true,
      fees: { corporation: [{ upTo: 1999.99, fee: 160 }, { upTo: 10000, fee: 324 }, { upTo: Infinity, fee: 648 }],
              person: [{ upTo: 1999.99, fee: 129 }, { upTo: 10000, fee: 259 }, { upTo: Infinity, fee: 518 }] }, feesFrom: '1 July 2026',
      feeNote: 'The first hearing day has no fee; extra hearing days are charged.',
      recoverable: null, checked: '2026-11-18',
      links: {
        guide: 'https://nt.gov.au/law/courts-and-tribunals/small-claims',
        form: 'https://ntcat.nt.gov.au/getting-started/forms',
        fees: 'https://ntcat.nt.gov.au/fees.shtml',
        help: 'https://ntcat.nt.gov.au/our-services/serving-documents'
      }, applyLabel: 'NT Government: small claims', formLabel: 'NTCAT forms (Form 1)', helpLabel: 'NTCAT: serving documents',
      checks: function(c, cl, add, d){
        var st = String(d.state || '').toUpperCase();
        if(st && st !== 'NT') add('caution', 'Respondent is in ' + st, 'Check with NTCAT that it can hear your claim against a respondent outside the NT before you apply.');
        add('info', 'The NT time limit is 3 years', 'Small claims must be made within three years of when the money was owed. If the debtor confirms the debt in writing within that time, the three years start again.');
        add('info', 'You present your own case', 'In small claims, a party can be represented by a lawyer only with NTCAT’s permission.');
      },
      extraEvidence: function(){ return [['service_proof', 'Documents showing how you served the sealed Form 1 and standard orders (NTCAT Service Guidelines)']]; } }
  };
  function recJur(c, m){
    if(m && m.jurisdiction) return m.jurisdiction;
    if(recState.jur) return recState.jur;
    var st = c && c.debtor && String(c.debtor.state || '').toUpperCase();
    return st && RECOVERY_RULES[st] && RECOVERY_RULES[st].live ? st : 'QLD';
  }
  function recRules(c, m){
    var base = RECOVERY_RULES[m && m.jurisdiction ? m.jurisdiction : recJur(c, m)];
    var f = (m && m.forum) || recState.forum;
    return f && base && base.alts && base.alts[f] ? base.alts[f] : base;
  }
  function recBase(c, m){ return RECOVERY_RULES[m && m.jurisdiction ? m.jurisdiction : recJur(c, m)]; }
  function recRespDays(R, c){ return R.responseDaysFor && c ? R.responseDaysFor(c.debtor) : R.responseDays; }
  function recFiles(R){ return !!(R && R.terms && R.verb !== 'lodge'); }
  function recTerms(R){ return (R && R.terms) || ['applicant', 'respondent']; }
  function cap1(t){ return t.charAt(0).toUpperCase() + t.slice(1); }
  // Fee rate from Settings → Business type: sole traders and partnerships of individuals pay the individual rate.
  function orgFeeEntity(){ var k = currentOrg && currentOrg.entity_kind; return !k ? null : (/^(sole_trader|partnership|individual)$/.test(k) ? 'person' : 'corporation'); }
  function recEntity(m){ return (m && m.applicant && m.applicant.entity) || recState.entity || orgFeeEntity() || 'corporation'; }
  var REC_STATUS = { preparing:'Preparing', lodged:'Lodged', served:'Served', responded:'Response received', no_response:'No response', hearing:'Hearing or conference set', decided:'Decision made', enforcing:'Enforcing order', paid:'Paid', closed:'Closed', withdrawn:'Withdrawn' };
  var REC_STATUS_TONE = { preparing:'new', lodged:'letter_sent', served:'awaiting_response', responded:'debt_recovery', no_response:'debt_recovery', hearing:'tribunal', decided:'payment_plan', enforcing:'escalated', paid:'resolved', closed:'resolved', withdrawn:'not_connected' };
  var RAISED_VIA = { email:'Email', phone:'Phone call', letter:'Letter', portal:'Debtor portal', tribunal_response:'Their tribunal response', other:'Other' };
  var recMatters = [], recState = { caseId: null, disputes: [], records: null, evidence: null, evidenceErr: '', openEvidence: {}, drafts: {} };

  function isoLocal(d){ d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDaysIso(iso, n){ var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoLocal(d); }
  function daysUntil(iso){ return Math.round((new Date(iso + 'T00:00:00') - new Date(isoLocal() + 'T00:00:00')) / 864e5); }
  function recCase(){ return cases.filter(function(c){ return c.id === recState.caseId; })[0] || null; }
  function recMatter(){ return recMatters.filter(function(m){ return m.case_id === recState.caseId; })[0] || null; }

  async function loadRecoveryMatters(){
    var r = await sb.from('recovery_matters').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false });
    recMatters = r.error ? [] : (r.data || []);
    recState.tableMissing = !!(r.error && /recovery_matters/.test(r.error.message || ''));
  }

  function renderRecoveryCaseOptions(){
    var sel = document.getElementById('recCaseSelect'); if(!sel) return;
    var withFile = {}; recMatters.forEach(function(m){ withFile[m.case_id] = m; });
    var list = cases.filter(function(c){ return c.status !== 'resolved' || withFile[c.id]; });
    if(!recState.caseId || !list.some(function(c){ return c.id === recState.caseId; })) recState.caseId = (recMatters[0] && list.some(function(c){ return c.id === recMatters[0].case_id; })) ? recMatters[0].case_id : (list[0] ? list[0].id : null);
    sel.innerHTML = list.length ? list.map(function(c){
      var m = withFile[c.id];
      return '<option value="'+escapeHtml(c.id)+'"'+(c.id === recState.caseId ? ' selected' : '')+'>'+escapeHtml(c.debtor.name || 'Debtor')+' — '+money(c.total)+(m ? ' · file: '+escapeHtml(REC_STATUS[m.status] || m.status) : '')+'</option>';
    }).join('') : '<option value="">No open cases</option>';
    renderRecoveryCaseList();
  }

  // Amounts for the claim, built from the same figures as letters (disputed invoices left out unless included).
  function recClaim(c, m){
    var opt = Object.assign({ include_interest: true, include_fees: false, include_disputed: false, abandon_excess: false, leave_out_stale: false }, (m && m.checklist && m.checklist.options) || recState.options || {});
    var lm = buildLetterModel(c, { pay_days: 7 });
    var rules = recRules(c, m);
    var items = lm.items.filter(function(i){ return opt.include_disputed || !i.disputed; });
    // Invoices that fell due before the time limit: the user can leave them out and claim the rest.
    var cutoff = rules.limitationYears ? addDaysIso(isoLocal(), -Math.round(rules.limitationYears * 365.25)) : null;
    var staleItems = cutoff ? items.filter(function(i){ return i.due_date && i.due_date < cutoff; }) : [];
    var leftOut = opt.leave_out_stale ? staleItems : [];
    if(leftOut.length) items = items.filter(function(i){ return leftOut.indexOf(i) < 0; });
    var sum = function(k){ return r2(items.reduce(function(s, x){ return s + (Number(x[k]) || 0); }, 0)); };
    var principal = sum('balance');
    var interest = opt.include_interest ? sum('interest') : 0;
    var fees = opt.include_fees ? r2(sum('fees') + (lm.totals.statement_fees || []).reduce(function(s, f){ return s + f.amount; }, 0)) : 0;
    var total = r2(principal + interest + fees);
    var entity = recEntity(m);
    var gross = total, abandoned = 0;
    if(rules.limitOver === 'abandon' && opt.abandon_excess && total > rules.limit){ abandoned = r2(total - rules.limit); total = rules.limit; }
    var bands = Array.isArray(rules.fees) ? rules.fees : (rules.fees ? rules.fees[entity] : []);
    var band = (bands || []).filter(function(b){ return total <= b.upTo; })[0] || null;
    return { opt: opt, lm: lm, gross: gross, abandoned: abandoned, entity: entity, items: items, staleItems: staleItems, leftOut: leftOut, cutoff: cutoff, disputedItems: lm.items.filter(function(i){ return i.disputed; }), principal: principal, interest: interest, fees: fees, total: total,
      fullInterest: r2(lm.items.reduce(function(s, i){ return s + (i.disputed && !opt.include_disputed ? 0 : (Number(i.interest) || 0)); }, 0)),
      fullFees: r2(items.reduce(function(s, x){ return s + (Number(x.fees) || 0); }, 0)), filingFee: band ? band.fee : null, rules: rules };
  }

  function recChecks(c, cl){
    var d = c.debtor, R = cl.rules, out = [], T = recTerms(R);
    var add = function(level, title, text, link){ out.push({ level: level, title: title, text: text || '', link: link || null }); };
    if(cl.total <= 0) add('stop', 'Nothing to claim', 'There is no undisputed amount owing on this case.');
    else if(!isFinite(R.limit)) add('ok', 'No upper limit', R.short + ' has no maximum claim amount for these disputes.');
    else if(cl.total > R.limit && R.limitOver === 'stop') add('stop', 'Over the ' + money(R.limit) + ' limit', money(cl.total) + ' is more than the ' + money(R.limit) + ' limit for ' + R.limitScope + (R.limitNote === 'including interest' ? ' (including interest)' : '') + '.' + (R.overText ? ' ' + R.overText : '') + ' DebtJet’s steps here cover ' + R.short + ' only.', R.largerLink);
    else if(cl.total > R.limit) add('caution', 'Over the ' + R.short + ' limit', money(cl.total) + ' is more than ' + R.short + '’s ' + money(R.limit) + ' limit. ' + R.short + ' says you can abandon the amount over ' + money(R.limit) + ' (tick “Abandon the excess” under Claim amount), or get the respondent’s written agreement to a higher claim.' + (R.overText ? ' ' + R.overText : ''), R.largerLink);
    else if(cl.abandoned) add('ok', 'Excess abandoned', money(cl.abandoned) + ' over the limit is abandoned, so you claim ' + money(cl.total) + '. An abandoned amount can’t be claimed later.');
    else add('ok', 'Within the ' + money(R.limit) + ' limit', money(cl.total) + ' claimed' + (R.limitNote === 'including interest' ? ', including interest' : '') + '.');
    var cutoff = addDaysIso(isoLocal(), -Math.round(R.limitationYears * 365.25));
    var warnCut = addDaysIso(isoLocal(), -Math.round((R.limitationYears - 0.5) * 365.25));
    var stale = cl.items.filter(function(i){ return i.due_date && i.due_date < cutoff; });
    var nearly = cl.items.filter(function(i){ return i.due_date && i.due_date >= cutoff && i.due_date < warnCut; });
    if(stale.length) add('stop', 'Time limit may have passed', stale.map(function(i){ return i.invoice_number; }).join(', ') + ' fell due more than ' + R.limitationYears + ' years ago. Claims for unpaid invoices generally have a ' + R.limitationYears + '-year time limit from when the debt fell due.' + (cl.items.length > stale.length ? ' To claim the other invoices, tick “Leave out invoices past the time limit” under Claim amount.' : ''));
    if(cl.leftOut.length) add('ok', 'Left out: past the time limit', cl.leftOut.map(function(i){ return i.invoice_number; }).join(', ') + ' (' + money(r2(cl.leftOut.reduce(function(s, i){ return s + (Number(i.balance) || 0); }, 0))) + ') fell due more than ' + R.limitationYears + ' years ago and ' + (cl.leftOut.length === 1 ? 'is' : 'are') + ' not in this claim.');
    else if(nearly.length) add('caution', 'Time limit approaching', nearly.map(function(i){ return i.invoice_number; }).join(', ') + ' will be ' + R.limitationYears + ' years overdue within six months.');
    else if(cl.items.length) add('ok', 'Inside the ' + R.limitationYears + '-year time limit', 'Oldest invoice in the claim fell due ' + fmt(cl.items[0].due_date) + '.');
    var dd = demandDates[c.id] || {};
    if(!dd.first) add('caution', 'No letter of demand recorded', R.resolveFirst + ' Send a letter of demand from Letters of Demand and record it as sent.');
    else add('ok', 'Letter of demand sent', (dd.final ? 'Final demand sent ' + fmt(dd.final) : 'First demand sent ' + fmt(dd.first)) + '.');
    if(isPerson(d)) add(/\s/.test(String(d.name || '').trim()) ? 'ok' : 'caution', cap1(T[1]) + ' is an individual: ' + (d.name || ''), 'Use the person’s full legal name (first and last name) and their home address. No ABN is needed.');
    else if(!d.debtor_kind) add('caution', 'Debtor type not set', 'Set whether the ' + T[1] + ' is a business or an individual on the contact card, so the right name and details are used.');
    if(isPerson(d)){}
    else if(!d.legal_name) add('caution', 'Legal name not confirmed', 'Name the ' + T[1] + ' by its legal entity name, not just a trading name. On the debtor’s contact card, use Re-check ABN to fill it from the ABN register, or Edit details to enter it from ABN Lookup or an ASIC search.');
    else if(!legalFromRegister(d)) add('info', cap1(T[1]) + ': ' + letterAddresseeName(d) + ' (entered by hand)', 'Not checked against the ABN register. Confirm the exact name on ABN Lookup or an ASIC search before you lodge.' + ([d.abn ? 'ABN ' + fmtAbn(d.abn) : '', d.acn ? 'ACN ' + fmtAcn(d.acn) : ''].filter(Boolean).map(function(x, i){ return (i ? ' · ' : ' ') + x; }).join('')));
    else add('ok', cap1(T[1]) + ': ' + letterAddresseeName(d), (d.abn ? 'ABN ' + fmtAbn(d.abn) : '') + (d.acn ? ' · ACN ' + fmtAcn(d.acn) : ''));
    if(d.abn_status && !/active/i.test(d.abn_status)) add('caution', 'ABN is ' + d.abn_status.toLowerCase(), 'The business may have closed or the company may be deregistered. Check ASIC before applying.');
    if(d.name_check && /mismatch|differ|problem/i.test(d.name_check)) add('caution', 'Name check needs attention', 'The name on file doesn’t match the ABN register. Fix it on the contact card.');
    if(!isPerson(d) && (d.acn || d.debtor_kind === 'company' || /company|pty/i.test((d.entity_type || '') + ' ' + (d.legal_name || '')))) add('info', 'Company ' + T[1], 'Consider a company search (ASIC extract) to confirm the company’s exact name and registered office.' + (R.recoverable ? ' The search fee is a cost you can ask ' + R.short + ' to award.' : ''));
    if(!postalLines(d).length) add('stop', cap1(T[1]) + ' address missing', 'You need the ' + T[1] + '’s full contact details on the ' + (R.docNoun || 'application') + ' and an address to serve it. Add it on the contact card.');
    if(R.checks) R.checks(c, cl, add, d, cl.entity);
    if(cl.disputedItems.length) add(cl.opt.include_disputed ? 'caution' : 'info', cl.disputedItems.length + ' disputed invoice' + (cl.disputedItems.length > 1 ? 's' : ''),
      cl.disputedItems.map(function(i){ return i.invoice_number; }).join(', ') + (cl.opt.include_disputed ? ' included in the claim. Record your response to each disputed point on the Disputed facts tab.' : ' left out of the claim. Record the disputed points on the Disputed facts tab if you decide to include them.'));
    var TB = (cl.interest > 0 || cl.fees > 0) ? recTermsBasis(c, cl) : null;
    var basis = TB ? 'Under “' + TB.document.title + '”, accepted ' + fmt(TB.acceptance.accepted_on) + (TB.evidence.length ? ' (' + TB.evidence.length + ' evidence item' + (TB.evidence.length === 1 ? '' : 's') + ')' : '') : '';
    if(cl.interest > 0) add('info', 'Interest included: ' + money(cl.interest), (basis ? basis + (TB.interest && TB.interest.clause ? ', ' + clauseLabel(TB.interest.clause) : '') + '. ' : '') + 'The evidence pack lists the terms, the acceptance and the wording relied on.');
    if(cl.fees > 0) add('caution', 'Fees included: ' + money(cl.fees), (basis ? basis + (TB.fees.length ? ', ' + TB.fees.map(function(f){ return f.name + (f.clause ? ' ' + clauseLabel(f.clause) : ''); }).join(', ') : '') + '. ' : '') + (R.recoverable ? R.short + '’s own costs you can ask for are limited to ' + R.recoverable + '.' : ''));
    return out;
  }

  function recDefaultDetails(c, cl){
    var d = c.debtor, dd = demandDates[c.id] || {}, T = recTerms(cl.rules);
    var nums = cl.items.map(function(i){ return i.invoice_number; });
    var list = nums.length <= 1 ? (nums[0] || '') : nums.slice(0, -1).join(', ') + ' and ' + nums.at(-1);
    var descs = cl.items.map(function(i){ return (i.description || '').trim(); }).filter(Boolean);
    var lines = [];
    lines.push('The ' + T[0] + ', ' + currentOrg.name + ', supplied goods and/or services to the ' + T[1] + ', ' + letterAddresseeName(d) + (descs.length ? ', described on the invoices as: ' + descs.slice(0, 4).join('; ') : '') + '.');
    lines.push('The ' + T[0] + ' issued ' + (nums.length > 1 ? 'invoices ' : 'invoice ') + list + ' for a total of ' + money(cl.items.reduce(function(s, i){ return s + i.amount; }, 0)) + '. ' +
      cl.items.map(function(i){ return i.invoice_number + ' was issued on ' + fmt(i.issued_date) + ' and fell due on ' + fmt(i.due_date) + (i.paid ? '; ' + money(i.paid) + ' has been paid' : '') + '.'; }).join(' '));
    if(dd.first) lines.push('The ' + T[0] + ' wrote to the ' + T[1] + ' demanding payment on ' + fmt(dd.first) + (dd.final && dd.final !== dd.first ? ' and again on ' + fmt(dd.final) : '') + '.');
    lines.push('As at ' + fmt(new Date()) + ', ' + money(cl.principal) + ' remains unpaid' + (cl.interest ? ', plus interest of ' + money(cl.interest) : '') + (cl.fees ? (cl.interest ? ' and ' : ', plus ') + 'fees of ' + money(cl.fees) : '') + ', a total of ' + money(cl.total) + '.');
    return lines.join('\n\n');
  }

  async function loadRecoveryRecords(c){
    var none = Promise.resolve({ data: [] });
    var res = await Promise.all([
      sb.from('recovery_disputes').select('*').eq('case_id', c.id).order('created_at'),
      sb.from('letters').select('id, type, subject, sent_at, send_via, status, snapshot').eq('case_id', c.id).eq('status', 'sent').order('sent_at'),
      sb.from('correspondence_log').select('*').eq('debtor_id', c.debtor.id).order('occurred_at'),
      sb.from('case_notes').select('id, invoice_id, category, summary, dispute_reason, occurred_at, source').eq('debtor_id', c.debtor.id).order('occurred_at'),
      sb.from('case_events').select('id, event_type, title, body, occurred_at').eq('case_id', c.id).order('occurred_at'),
      sb.from('payments').select('invoice_id, amount, paid_at, method, source').eq('case_id', c.id).order('paid_at'),
      sb.from('invoices').select('id, invoice_number, description, amount, issued_date, due_date, status').eq('debtor_id', c.debtor.id).order('due_date')
    ]);
    if(recState.caseId !== c.id) return;
    recState.disputesMissing = !!(res[0].error && /recovery_disputes/.test(res[0].error.message || ''));
    recState.disputes = res[0].data || [];
    recState.records = { letters: res[1].data || [], log: res[2].data || [], notes: res[3].data || [], events: res[4].data || [], payments: res[5].data || [], invoices: res[6].data || [] };
  }

  async function selectRecoveryCase(id){
    recState.caseId = id; recState.records = null; recState.disputes = []; recState.evidence = null; recState.evidenceErr = ''; recState.drafts = {}; recState.options = null; recState.jur = null; recState.entity = null; recState.forum = null;
    var c = recCase();
    renderRecovery();
    if(!c) return;
    setHistoryDebtors('recovery', [c.debtor.id]);
    await loadRecoveryRecords(c);
    renderRecovery();
  }

  function recStepState(m){
    var s = m ? m.status : null, order = ['preparing','lodged','served'];
    var at = !m ? 1 : s === 'preparing' ? (m.checklist && m.checklist.application_saved ? 4 : 3) : s === 'lodged' ? 6 : 7;
    return function(n){ return n < at ? 'done' : n === at ? 'current' : 'todo'; };
  }

  function recNextAction(m, c, cl){
    if(!m) return { text: 'Check eligibility and the claim amount, then start a recovery file.', due: null };
    var R = recRules(c, m) || RECOVERY_RULES.QLD;
    switch(m.status){
      case 'preparing': return { text: m.checklist && m.checklist.application_saved ? 'Print the evidence pack, then ' + (R.terms ? (recFiles(R) ? 'file' : 'lodge') + ' the ' + (R.docNoun || 'claim') + ' with the ' : 'lodge ' + R.form.split(':')[0] + ' with ') + R.short + ' and record it here.' : 'Complete the application details and save them.', due: null };
      case 'lodged': if(R.serveWithinMonths && m.lodged_on){ var sd = new Date(m.lodged_on + 'T00:00:00'); sd.setMonth(sd.getMonth() + R.serveWithinMonths); return { text: 'Serve the ' + R.claimLabel.toLowerCase() + ' on the ' + recTerms(R)[1] + ' (it must be served within ' + R.serveWithinMonths + ' months of filing), then record the date and method.', due: isoLocal(sd) }; }
        return { text: R.tribunalServes ? R.short + ' serves the application by post unless you chose to serve it. Record the service date and response date from ' + R.short + '’s letter.' : 'Serve the application on the respondent, then record the date and method.', due: null };
      case 'served': return { text: 'Wait for the ' + recTerms(R)[1] + '’s response. ' + R.responseNote, due: m.response_due };
      case 'responded': return { text: 'Record each point they dispute and your response (Disputed facts), and prepare for mediation or a hearing.', due: m.hearing_at ? String(m.hearing_at).slice(0, 10) : null };
      case 'no_response': return { text: R.noResponse, due: null };
      case 'hearing': return { text: 'Hearing set. Bring the evidence pack and your approved responses.', due: m.hearing_at ? String(m.hearing_at).slice(0, 10) : null };
      case 'decided': return { text: R.decided, due: null };
      case 'enforcing': return { text: 'Enforcing the order. Record payments as they arrive.', due: null };
      default: return { text: 'This file is ' + (REC_STATUS[m.status] || m.status).toLowerCase() + '.', due: null };
    }
  }

  function recEvidenceList(c){
    var r = recState.records; if(!r) return [];
    var ev = [];
    r.invoices.forEach(function(i){ ev.push({ at: i.issued_date, kind: 'Invoice issued', text: i.invoice_number + ' · ' + money(i.amount) + (i.description ? ' · ' + i.description : '') + ' · due ' + fmt(i.due_date) }); });
    r.payments.forEach(function(p){ ev.push({ at: p.paid_at, kind: REC_PAY_KIND[p.method] || 'Payment received', text: money(p.amount) + (p.source === 'xero' ? ' · from Xero' : p.method && !REC_PAY_KIND[p.method] ? ' · ' + p.method : '') }); });
    r.letters.forEach(function(l, n){ ev.push({ at: l.sent_at, kind: (TPL_LABEL[l.type] || 'Letter') + ' sent', text: (l.subject || '') + (l.send_via ? ' · via ' + l.send_via : '') + (l.snapshot && l.snapshot.html ? ' · copy at Annexure A' + (n + 1) : '') }); });
    r.log.forEach(function(x){ ev.push({ at: x.occurred_at, kind: (x.direction === 'in' ? 'Received' : x.direction === 'out' ? 'Sent' : 'Note') + ' (' + (HIST_CHANNEL[x.channel] || x.channel) + ')', text: (x.subject ? x.subject + ': ' : '') + x.summary }); });
    // Hardship notes can hold health or personal details; they stay out of the pack.
    r.notes.forEach(function(x){ if(x.category === 'hardship') return; ev.push({ at: x.occurred_at, kind: x.source === 'manual' ? 'Note' : 'Email from debtor (summary)', text: x.summary + (x.dispute_reason ? ' Dispute: ' + x.dispute_reason : '') }); });
    r.events.forEach(function(x){ if(x.event_type === 'letter_sent') return; ev.push({ at: x.occurred_at, kind: 'Event', text: x.title + (x.body ? ': ' + x.body : '') }); });
    return ev.filter(function(e){ return e.at; }).sort(function(a, b){ return String(a.at).localeCompare(String(b.at)); });
  }

  var REC_SECTION_PRESETS = [['chronology', 'Chronology'], ['orders', 'Orders you ask for'], ['response', 'Their position and your answer'], ['other', 'Other information'], ['custom', 'Blank section']];
  var recSecSeq = 0, recRichCur = null, recAssistCtx = null;
  function recSectionHtml(x, id){
    return '<div class="rec-sec" data-secid="'+id+'"><div class="rec-sec-h"><input class="rec-sec-title" data-rf="sec.'+id+'.title" maxlength="120" placeholder="Section heading" value="'+escapeHtml(x.title || '')+'" />'
      + '<span class="rec-sec-acts"><button type="button" data-rsec="up" title="Move up">↑</button><button type="button" data-rsec="down" title="Move down">↓</button><button type="button" data-rsec="del" title="Remove section">✕</button></span></div>'
      + '<textarea hidden data-rf="sec.'+id+'.text">'+escapeHtml(x.text || '')+'</textarea><div class="rec-rich" data-rich-for="sec.'+id+'.text">'+djRich(x.text || '', {}, 'edit')+'</div></div>';
  }
  function recSectionPreset(kind, c, cl){
    var R = cl.rules, T = recTerms(R), name = letterAddresseeName(c.debtor), dd = demandDates[c.id] || {};
    if(kind === 'chronology'){
      var ev = [];
      cl.items.forEach(function(i){ if(i.issued_date) ev.push([i.issued_date, 'We issued invoice ' + i.invoice_number + ' for ' + money(i.amount) + ', due ' + fmt(i.due_date) + '.']); });
      if(dd.first) ev.push([dd.first, 'We sent a letter of demand.']);
      if(dd.final && dd.final !== dd.first) ev.push([dd.final, 'We sent a final letter of demand.']);
      ev.sort(function(a, b){ return a[0] < b[0] ? -1 : 1; });
      return { title: 'Chronology', text: ev.map(function(e){ return '- ' + fmt(e[0]) + ': ' + e[1]; }).join('\n') || '- [date]: [what happened]' };
    }
    if(kind === 'orders') return { title: 'Orders you ask for', text: '- That ' + name + ' pay ' + money(cl.total) + '.' + (cl.filingFee != null ? '\n- That ' + name + ' pay the filing fee of ' + money(cl.filingFee) + ' and the cost of service.' : '') };
    if(kind === 'response') return { title: 'Their position and your answer', text: cap1(T[1]) + ' says [what they have said].\n\nWe do not agree because [your reason], as shown in [document].' };
    if(kind === 'other') return { title: 'Other information', text: '' };
    return { title: '', text: '' };
  }
  function attachRecRich(root){
    root.querySelectorAll('.rec-rich').forEach(function(el){
      if(el._dj) return;
      var ta = root.querySelector('[data-rf="'+el.getAttribute('data-rich-for')+'"]');
      djAttach(el, { onChange: function(md){ if(ta) ta.value = md; }, onFocus: function(){ recRichCur = el; } });
    });
  }
  function recInsertParagraph(text){
    var root = document.getElementById('recRoot');
    var el = recRichCur && root.contains(recRichCur) ? recRichCur : root.querySelector('.rec-rich[data-rich-for="details"]');
    if(!el){ toast('Open the Claim tab to add to the application details.'); return; }
    var cur = djSerialize(el), md = (cur ? cur + '\n\n' : '') + text;
    el.innerHTML = djRich(md, {}, 'edit'); djFire(el);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('flash'); setTimeout(function(){ el.classList.remove('flash'); }, 900);
  }
  var REC_ASSIST = { scope: 'claim', aiPurpose: 'claim_details', builtins: CLAIM_CLAUSES, placeholder: 'e.g. explain they accepted our quote by email on 3 June',
    vars: function(){ if(!recAssistCtx) return {}; var V = Object.assign({}, buildLetterModel(recAssistCtx.c, { pay_days: 7 }).vars); V.debtor_name = letterAddresseeName(recAssistCtx.c.debtor); V.total_owing = money(recAssistCtx.cl.total); V.principal = money(recAssistCtx.cl.principal); V.interest = money(recAssistCtx.cl.interest); return V; },
    canAi: function(){ return !!recAssistCtx; },
    aiPayload: function(){ var el = document.querySelector('#recRoot .rec-rich[data-rich-for="details"]'); return { case_id: recAssistCtx && recAssistCtx.c.id, context_text: el ? djPlain(djSerialize(el)).slice(0, 3000) : '' }; },
    preview: function(t){ return djRich(fillLetterText(t, REC_ASSIST.vars(), true), {}, 'html'); },
    insert: function(text){ recInsertParagraph(fillLetterText(text, REC_ASSIST.vars(), true)); }
  };
  function recField(label, key, val, opts){
    opts = opts || {};
    var inner = opts.textarea ? '<textarea data-rf="'+key+'" rows="'+(opts.rows || 3)+'">'+escapeHtml(val || '')+'</textarea>'
      : opts.select ? '<select data-rf="'+key+'">'+opts.select.map(function(o){ return '<option value="'+escapeHtml(o[0])+'"'+(String(val || '') === o[0] ? ' selected' : '')+'>'+escapeHtml(o[1])+'</option>'; }).join('')+'</select>'
      : '<input data-rf="'+key+'" type="'+(opts.type || 'text')+'" value="'+escapeHtml(val || '')+'"'+(opts.ph ? ' placeholder="'+escapeHtml(opts.ph)+'"' : '')+'>';
    return '<label class="rec-f'+(opts.wide ? ' wide' : '')+'"><span>'+escapeHtml(label)+'</span>'+inner+(opts.hint ? '<em>'+escapeHtml(opts.hint)+'</em>' : '')+'</label>';
  }

  function renderRecovery(){
    var root = document.getElementById('recRoot'); if(!root) return;
    renderRecoveryFiles(); renderRecoveryCaseCard();
    if(recState.tableMissing){ root.innerHTML = '<div class="card"><div class="card-body">Debt Recovery needs a database update before it can be used. Ask your administrator to apply the latest migration.</div></div>'; return; }
    var c = recCase();
    if(!c){ renderRecTabBadges(null); root.innerHTML = '<div class="card"><div class="card-body empty-note">Choose a case in the Cases tab to start.</div></div>'; return; }
    var m = recMatter();
    var jur = recJur(c, m);
    document.getElementById('recJurSelect').value = jur;
    var R = recRules(c, m), B = recBase(c, m);
    if(!R.live){
      root.innerHTML = '<div class="card"><div class="card-body"><h3 style="margin:0 0 6px;">'+escapeHtml(R.forumName)+'</h3><p class="muted">Small claims limit: '+money(R.limit)+'. Step-by-step support for '+escapeHtml(jur)+' is coming. Available now: '+escapeHtml(Object.keys(RECOVERY_RULES).filter(function(k){ return RECOVERY_RULES[k].live; }).map(function(k){ return k + ' (' + RECOVERY_RULES[k].short + ')'; }).join(', '))+'.</p></div></div>';
      return;
    }
    var cl = recClaim(c, m), checks = recChecks(c, cl), stop = checks.some(function(x){ return x.level === 'stop'; });
    var st = recStepState(m), na = recNextAction(m, c, cl);
    var A = (m && m.applicant) || {}, P = (m && m.respondent) || {}, snap = (m && m.claim_snapshot) || {};
    var defApplicant = { name: currentOrg.name, abn: '', address: (brandSettings('default').from_lines || ''), phone: '', email: session && session.user ? session.user.email : '' };
    A = Object.assign({}, defApplicant, A);
    var d = c.debtor;
    var defResp = { name: d.legal_name || d.name || '', trading: d.legal_name && d.name && d.legal_name !== d.name ? d.name : '', abn: d.abn ? fmtAbn(d.abn) : '', acn: d.acn ? fmtAcn(d.acn) : '', address: postalLines(d).join('\n'), contact: d.contact_name || '', email: d.email || '', phone: d.phone || '' };
    P = Object.assign({}, defResp, P);
    var details = snap.details || recDefaultDetails(c, cl);
    var step = function(n, title, body, extraHead){
      var s = st(n);
      return '<section class="card rec-step '+s+'" data-step="'+n+'"><div class="rec-step-head"><span class="rec-num">'+(s === 'done' ? '✓' : n)+'</span><h3>'+title+'</h3>'+(extraHead || '')+'</div><div class="rec-step-body">'+body+'</div></section>';
    };
    var html = '', P2 = { forum: '', start: '', s3: '', s4: '', s5: '', s6: '', s7: '' };
    if(B && B.forumChoices){
      P2.forum = '<div class="card rec-forum"><div class="card-body"><b>Court or VCAT?</b><div class="rec-forum-opts">'
        + B.forumChoices.map(function(fc){ return '<label class="rec-tog"><input type="radio" name="recForum" data-rforum="'+escapeHtml(fc[0])+'"'+(R.forum === fc[0] ? ' checked' : '')+(m ? ' disabled' : '')+'> '+escapeHtml(fc[1])+'</label>'; }).join('')
        + '</div><p class="muted small">The Magistrates’ Court suits most unpaid invoices and other debts, and can make an order without a hearing if the debtor doesn’t defend. VCAT’s Civil Claims List hears disputes about goods or services you supplied. It is built for people without lawyers, but cases go to a mediation or hearing. '+(m ? 'This file is set up for '+escapeHtml(R.short)+'. Delete it to switch.' : 'The choice is yours.')+'</p></div></div>';
    }
    // 1. Eligibility
    P2.s1 = step(1, 'Check eligibility', '<ul class="rec-checks">' + checks.map(function(x){ return '<li class="'+x.level+'"><b>'+escapeHtml(x.title)+'</b>'+(x.text ? '<span>'+escapeHtml(x.text)+(x.link && /^https:\/\//.test(x.link) ? ' <a href="'+escapeHtml(x.link)+'" target="_blank" rel="noopener">Court’s page ↗</a>' : '')+'</span>' : '')+'</li>'; }).join('') + '</ul>');
    // 2. Claim amount
    var locked = m && m.status !== 'preparing';
    var tog = function(k, label, extra){ return '<label class="rec-tog"><input type="checkbox" data-ropt="'+k+'"'+(cl.opt[k] ? ' checked' : '')+(locked ? ' disabled' : '')+'> '+escapeHtml(label)+(extra ? ' <em>'+escapeHtml(extra)+'</em>' : '')+'</label>'; };
    var rows = cl.items.map(function(i){ return '<tr><td>'+escapeHtml(i.invoice_number)+(i.disputed ? ' <span class="pill escalated">disputed</span>' : '')+'</td><td>'+fmt(i.issued_date)+'</td><td>'+fmt(i.due_date)+'</td><td class="num">'+money(i.balance)+'</td><td class="num">'+(cl.opt.include_interest ? money(i.interest) : '—')+'</td><td class="num">'+(cl.opt.include_fees ? money(i.fees) : '—')+'</td></tr>'; }).join('');
    P2.s2 = step(2, 'Claim amount',
      (locked ? '<p class="muted small">Amounts were locked when the application was lodged. Figures below are today’s.</p>' : '')
      + '<div class="rec-togs">' + tog('include_interest', 'Include interest', money(cl.fullInterest)) + tog('include_fees', 'Include fees', money(cl.fullFees)) + (cl.disputedItems.length ? tog('include_disputed', 'Include disputed invoices') : '')
      + (cl.staleItems.length ? tog('leave_out_stale', 'Leave out invoices past the time limit', cl.staleItems.map(function(i){ return i.invoice_number; }).join(', ') + ' · ' + money(r2(cl.staleItems.reduce(function(s, i){ return s + (Number(i.balance) || 0); }, 0)))) : '')
      + (R.limitOver === 'abandon' && (cl.gross > R.limit || cl.opt.abandon_excess) ? tog('abandon_excess', 'Abandon the excess over ' + money(R.limit), cl.gross > R.limit ? money(r2(cl.gross - R.limit)) : '') : '')
      + (R.entityFees ? '<label class="rec-tog">You pay <select data-rentity'+(locked ? ' disabled' : '')+'><option value="corporation"'+(cl.entity !== 'person' ? ' selected' : '')+'>the corporation fee</option><option value="person"'+(cl.entity === 'person' ? ' selected' : '')+'>the individual fee</option></select></label>'
        + '<span class="muted small rec-ent-src">' + (!orgFeeEntity() ? '<a href="#" data-goto-settings>Set your business type in Settings</a>' : (cl.entity === orgFeeEntity() ? 'From Settings' : 'Changed for this claim (Settings says ' + (orgFeeEntity() === 'person' ? 'individual' : 'corporation') + ')')) + '</span>' : '')
      + '</div>'
      + '<div class="rec-total"><div><span>Unpaid invoices</span><b>'+money(cl.principal)+'</b></div><div><span>Interest</span><b>'+money(cl.interest)+'</b></div><div><span>Fees</span><b>'+money(cl.fees)+'</b></div><div class="t"><span>Amount claimed</span><b>'+money(cl.total)+'</b>'+(cl.abandoned ? '<em class="small">'+money(cl.abandoned)+' abandoned</em>' : '')+'</div><div><span>Estimated filing fee</span><b>'+(cl.filingFee != null ? money(cl.filingFee) : '—')+'</b></div></div>'
      + '<p class="muted small">Filing fees from '+escapeHtml(R.feesFrom)+'. Fees change: <a href="'+R.links.fees+'" target="_blank" rel="noopener">check '+escapeHtml(R.theShort || R.short)+'’s current fees</a> before lodging.'+(R.entityFees ? ' Corporations (companies, incorporated associations, co-ops and councils) pay a higher fee. Sole traders and partnerships of individuals pay the individual fee.' : '')+(R.feeNote ? ' ' + escapeHtml(R.feeNote) : '')+(R.recoverable ? ' You can ask '+escapeHtml(R.short)+' to award '+escapeHtml(R.recoverable)+'.' : '')+'</p>'
      + '<div class="rec-tablewrap"><table class="rec-table"><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th class="num">Unpaid</th><th class="num">Interest</th><th class="num">Fees</th></tr></thead><tbody>'+(rows || '<tr><td colspan="6" class="empty-note">No invoices in the claim.</td></tr>')+'</tbody></table></div>');
    if(!m){
      P2.start = '<div class="card rec-start"><div class="card-body"><div><b>Ready to prepare '+(R.terms ? 'your ' + escapeHtml(R.short) + ' ' + escapeHtml(R.docNoun || 'claim') : (/^(A|E|I|O|U|N)/.test(R.short) ? 'an ' : 'a ') + escapeHtml(R.short) + ' application')+'?</b><p class="muted small">Starting a file records the claim, keeps your application details and tracks lodging, service and the response deadline. Nothing is sent or lodged for you.</p></div>'
        + '<button class="btn primary" type="button" id="recStartBtn"'+(stop ? ' disabled title="Fix the items marked in red first"' : '')+'>Start recovery file</button></div></div>';
    } else {
      // 3. Application details
      P2.s3 = step(3, 'Application details',
        '<p class="muted small">Information for '+escapeHtml(R.form)+', prepared from your records. Check every detail. You copy it into '+escapeHtml(R.copyTarget)+', sign it and lodge it yourself.</p>'
        + '<div class="rec-cols"><div><h4>'+cap1(recTerms(R)[0])+' (you)</h4>' + recField('Name', 'a.name', A.name) + recField('ABN', 'a.abn', A.abn) + recField('Address', 'a.address', A.address, { textarea: true, rows: 3 }) + recField('Phone', 'a.phone', A.phone) + recField('Email', 'a.email', A.email, { type: 'email' }) + '</div>'
        + '<div><h4>'+cap1(recTerms(R)[1])+'</h4>' + recField('Legal name', 'p.name', P.name, { hint: 'The entity’s legal name from the ABN or ASIC register.' }) + recField('Trading as', 'p.trading', P.trading) + '<div class="rec-2">' + recField('ABN', 'p.abn', P.abn) + recField('ACN', 'p.acn', P.acn) + '</div>' + recField('Address for service', 'p.address', P.address, { textarea: true, rows: 3 }) + recField('Contact person', 'p.contact', P.contact) + '<div class="rec-2">' + recField('Email', 'p.email', P.email) + recField('Phone', 'p.phone', P.phone) + '</div></div></div>'
        + '<div class="rec-f wide"><span>Details of the claim</span><textarea hidden data-rf="details">'+escapeHtml(details)+'</textarea><div class="rec-rich" data-rich-for="details">'+djRich(details, {}, 'edit')+'</div><em>Facts only: what was supplied, the invoices, dates, demands and what is unpaid. Select text to format it; use the panel on the right to add paragraphs.</em></div>'
        + '<div id="recSecs">' + (snap.sections || []).map(function(x, i){ return recSectionHtml(x, 's' + i); }).join('') + '</div>'
        + '<div class="rec-addsec"><span>Add a section</span>' + REC_SECTION_PRESETS.map(function(x){ return '<button type="button" data-raddsec="'+x[0]+'">'+escapeHtml(x[1])+'</button>'; }).join('') + '</div>'
        + '<div class="rec-acts"><button class="btn primary" type="button" data-ract="save-app">Save application details</button><button class="btn" type="button" data-ract="regen">Rebuild details from records</button><button class="btn" type="button" data-ract="copy-app">Copy all</button><button class="btn" type="button" data-ract="print-app">Print / PDF</button>'
        + '<a class="btn ghost" href="'+R.links.guide+'" target="_blank" rel="noopener">'+escapeHtml(R.applyLabel)+' ↗</a><a class="btn ghost" href="'+R.links.form+'" target="_blank" rel="noopener">'+escapeHtml(R.formLabel)+' ↗</a></div>');
      // 4. Evidence pack
      var r = recState.records || { invoices: [], letters: [], log: [], notes: [], payments: [], events: [] };
      var ck = (m.checklist && m.checklist.items) || {};
      var approved = recState.disputes.filter(function(x){ return x.approved_at; }).length;
      var auto = [
        [r.invoices.length > 0, 'Invoices (' + r.invoices.length + ')'],
        [r.letters.length > 0, 'Letters sent, with exact copies (' + r.letters.length + ')'],
        [r.log.length + r.notes.length > 0, 'Correspondence and notes (' + (r.log.length + r.notes.length) + ')'],
        [true, 'Chronology of the account (built automatically)'],
        [!recState.disputes.length || approved === recState.disputes.length, 'Responses to disputed points (' + approved + ' of ' + recState.disputes.length + ' approved)']
      ];
      var manual = [['terms', 'Your terms, quote or contract showing the agreed price (and interest or fees, if claimed)'], ['delivery', 'Proof the goods were delivered or the work was done'], ['asic', 'Company search showing the ' + recTerms(R)[1] + '’s exact name and registered office (if it is a company)']].concat(R.extraEvidence ? R.extraEvidence(cl, cl.entity) : []);
      P2.s4 = step(4, 'Evidence pack',
        '<p class="muted small">'+escapeHtml(R.short)+' will need to see evidence. The pack collects your records in date order with copies of every letter you sent. Add your own documents (terms, delivery dockets, photos) when you lodge.</p>'
        + '<ul class="rec-ev">' + auto.map(function(x){ return '<li class="'+(x[0] ? 'ok' : 'todo')+'">'+escapeHtml(x[1])+'</li>'; }).join('')
        + manual.map(function(x){ return '<li class="man"><label><input type="checkbox" data-rck="'+x[0]+'"'+(ck[x[0]] ? ' checked' : '')+'> '+escapeHtml(x[1])+'</label></li>'; }).join('') + '</ul>'
        + '<div class="rec-acts"><button class="btn primary" type="button" data-ract="print-pack">Print evidence pack</button></div>');
      // 5. Lodge
      P2.s5 = step(5, recFiles(R) ? 'File with ' + (R.theShort || 'the ' + R.short) : 'Lodge with ' + (R.theShort || R.short),
        '<p class="muted small">'+escapeHtml(R.lodge)+'</p><div class="rec-row">'
        + recField(recFiles(R) ? 'Date filed' : 'Date lodged', 'lodged_on', m.lodged_on, { type: 'date' }) + recField(R.fileLabel, 'file_number', m.file_number, { ph: R.filePh }) + recField('Filing fee paid', 'filing_fee', m.filing_fee != null ? m.filing_fee : (cl.filingFee || ''), { type: 'number' })
        + '</div><div class="rec-acts"><button class="btn primary" type="button" data-ract="save-lodge">'+(m.lodged_on ? 'Update' : (recFiles(R) ? 'Record as filed' : 'Record as lodged'))+'</button></div>');
      // 6. Serve
      P2.s6 = step(6, 'Serve the ' + recTerms(R)[1],
        '<p class="muted small">'+escapeHtml(R.serveIntro)+'</p><div class="rec-row">'
        + recField('Date served', 'served_on', m.served_on, { type: 'date' }) + recField('How', 'service_method', m.service_method, { select: [['', 'Choose…']].concat(R.tribunalServes || R.courtPost ? [['tribunal', R.courtPost || 'Served by ' + R.short + ' (post)']] : []).concat([['post', 'Post'], ['email', 'Email'], ['hand', 'By hand'], ['process_server', 'Process server / bailiff'], ['other', 'Other']]) })
        + recField('Response due', 'response_due', m.response_due || (m.served_on && recRespDays(R, c) ? addDaysIso(m.served_on, recRespDays(R, c)) : ''), { type: 'date', hint: !R.responseDays ? 'Enter the date in ' + R.short + '’s orders.' : R.tribunalServes ? 'Use the date in ' + R.short + '’s letter.' : 'Worked out from the service date. Change it if ' + (R.theShort || R.short) + ' gives a different date.' })
        + '</div><div class="rec-acts"><button class="btn primary" type="button" data-ract="save-serve"'+(m.lodged_on ? '' : ' disabled title="Record the lodgement first"')+'>'+(m.served_on ? 'Update' : 'Record service')+'</button></div>');
      // 7. Response and outcome
      P2.s7 = step(7, 'Response, hearing and outcome',
        '<div class="rec-row">' + recField('Status', 'status', m.status, { select: Object.keys(REC_STATUS).map(function(k){ return [k, REC_STATUS[k]]; }) })
        + recField(R.hearingLabel, 'hearing_at', m.hearing_at ? String(m.hearing_at).slice(0, 16) : '', { type: 'datetime-local' }) + '</div>'
        + recField('Outcome or notes', 'outcome', m.outcome, { textarea: true, rows: 3, wide: true })
        + '<div class="rec-acts"><button class="btn primary" type="button" data-ract="save-status">Save</button><a class="btn ghost" href="'+R.links.help+'" target="_blank" rel="noopener">'+escapeHtml(R.helpLabel)+' ↗</a></div>');
    }
    // Side: summary + disputes
    var dueTxt = na.due ? (function(n){ return n < 0 ? Math.abs(n) + ' days ago' : n === 0 ? 'today' : 'in ' + n + ' days'; })(daysUntil(na.due)) : '';
    var side = '<div class="card rec-sum"><div class="card-body">'
      + '<div class="rec-sum-top"><span class="pill '+(m ? REC_STATUS_TONE[m.status] : 'not_connected')+'">'+(m ? escapeHtml(REC_STATUS[m.status]) : 'No file yet')+'</span><span class="muted small">'+escapeHtml(R.short)+' · '+escapeHtml(R.kind)+'</span></div>'
      + '<div class="rec-sum-amt">'+money(m && m.status !== 'preparing' && m.total_claimed ? m.total_claimed : cl.total)+'</div><div class="muted small">'+(m && m.status !== 'preparing' ? 'claimed' : 'to claim')+' from '+escapeHtml(letterAddresseeName(c.debtor))+'</div>'
      + '<dl class="rec-dl">' + (m && m.file_number ? '<dt>File</dt><dd>'+escapeHtml(m.file_number)+'</dd>' : '') + (m && m.lodged_on ? '<dt>'+(recFiles(R) ? 'Filed' : 'Lodged')+'</dt><dd>'+fmt(m.lodged_on)+'</dd>' : '') + (m && m.served_on ? '<dt>Served</dt><dd>'+fmt(m.served_on)+'</dd>' : '') + (m && m.response_due ? '<dt>Response due</dt><dd>'+fmt(m.response_due)+'</dd>' : '') + (m && m.hearing_at ? '<dt>Hearing</dt><dd>'+fmtDateTime(m.hearing_at)+'</dd>' : '') + '</dl>'
      + '<div class="rec-next"><b>Next</b><span>'+escapeHtml(na.text)+'</span>'+(na.due ? '<em class="'+(daysUntil(na.due) < 0 ? 'late' : '')+'">'+fmt(na.due)+' · '+dueTxt+'</em>' : '')+'</div>'
      + (m ? '<button class="btn ghost sm" type="button" data-ract="delete-file">Delete file</button>' : '')
      + '</div></div>'
      + '<div class="card rec-note"><div class="card-body small">DebtJet organises your own records and '+escapeHtml(R.theShort || R.short)+'’s published steps. It isn’t a law firm and doesn’t give legal advice. You decide whether to apply, and you sign, lodge, serve and present your own case. Rules last checked '+fmt(R.checked)+'.</div></div>';
    var nxt = function(t, label){ return '<div class="rec-next-tab"><button class="btn" type="button" data-rtab-go="'+t+'">'+label+' →</button></div>'; };
    var needFile = '<div class="card"><div class="card-body rec-needfile"><span class="muted">Start a recovery file on the Claim tab first.</span><button class="btn sm" type="button" data-rtab-go="claim">Go to Claim</button></div></div>';
    var tab = REC_STEP_TABS.indexOf(recTab) >= 0 ? recTab : recBestTab(m);
    html = {
      eligibility: P2.forum + P2.s1 + nxt('claim', 'Next: Claim'),
      claim: P2.s2 + (m ? P2.s3 + nxt('evidence', 'Next: Evidence') : P2.start),
      evidence: m ? P2.s4 + nxt('disputes', 'Next: Disputed facts') : needFile,
      disputes: renderDisputesCard(c, m) + nxt('lodge', 'Next: Lodge & serve'),
      lodge: m ? P2.s5 + P2.s6 + nxt('outcome', 'Next: Outcome') : needFile,
      outcome: m ? P2.s7 : needFile
    }[tab];
    var showAssist = tab === 'claim' && m;
    root.innerHTML = '<div class="rec-shell"><div class="rec-main">'+html+'</div><aside class="rec-side">'+side+'</aside></div>';
    recRichCur = null; recAssistCtx = showAssist ? { c: c, cl: cl } : null;
    attachRecRich(root);
    if(curView === 'recovery' && !document.getElementById('insPanel').hidden) renderInsPanel();
    renderRecTabBadges({ st: st, m: m, stops: checks.filter(function(x){ return x.level === 'stop'; }).length, openDisputes: recState.disputes.filter(function(x){ return !x.approved_at; }).length });
  }

  function renderRecoveryFiles(){
    var box = document.getElementById('recFiles'); if(!box) return;
    if(!recMatters.length){ box.hidden = true; return; }
    box.hidden = false;
    var byCase = {}; cases.forEach(function(c){ byCase[c.id] = c; });
    box.querySelector('tbody').innerHTML = recMatters.map(function(m){
      var c = byCase[m.case_id], na = c ? recNextAction(m, c, null) : { due: null };
      return '<tr class="clickable'+(m.case_id === recState.caseId ? ' sel' : '')+'" data-rcase="'+escapeHtml(m.case_id)+'"><td><b>'+escapeHtml(c ? c.debtor.name : '—')+'</b></td><td>'+escapeHtml(c ? recRules(c, m).short : (RECOVERY_RULES[m.jurisdiction] ? RECOVERY_RULES[m.jurisdiction].short : m.jurisdiction))+'</td><td><span class="pill '+REC_STATUS_TONE[m.status]+'">'+escapeHtml(REC_STATUS[m.status] || m.status)+'</span></td><td class="num">'+money(m.total_claimed)+'</td><td>'+escapeHtml(m.file_number || '—')+'</td><td>'+(na.due ? fmt(na.due) + (daysUntil(na.due) < 0 ? ' <span class="pill escalated">passed</span>' : '') : '—')+'</td></tr>';
    }).join('');
  }

  /* ---------- Disputed facts ---------- */
  function renderDisputesCard(c, m){
    if(recState.disputesMissing) return '';
    var invOpts = function(sel){ return '<option value="">Whole account</option>' + (recState.records ? recState.records.invoices : c.invoices).map(function(i){ return '<option value="'+escapeHtml(i.id)+'"'+(sel === i.id ? ' selected' : '')+'>'+escapeHtml(i.invoice_number)+'</option>'; }).join(''); };
    var invNo = {}; (recState.records ? recState.records.invoices : c.invoices).forEach(function(i){ invNo[i.id] = i.invoice_number; });
    var notesToImport = recState.records ? recState.records.notes.filter(function(n){ return n.category === 'dispute' && !recState.disputes.some(function(x){ return x.debtor_says === (n.dispute_reason || n.summary); }); }) : [];
    var list = recState.disputes.map(function(x){
      var dr = recState.drafts[x.id] || {};
      var status = x.approved_at ? '<span class="pill resolved">Approved '+fmt(x.approved_at)+'</span>' : x.our_response ? '<span class="pill awaiting_response">'+(x.ai_drafted ? 'AI draft · needs your review' : 'Draft')+'</span>' : '<span class="pill new">No response yet</span>';
      var ev = (x.evidence || []).map(function(e){ return '<span class="rec-evchip" title="'+escapeHtml(e.text || '')+'">'+escapeHtml(e.key)+'</span>'; }).join('');
      var gaps = (x.gaps || []).length ? '<div class="rec-gaps"><b>Missing or unsupported</b><ul>' + x.gaps.map(function(g){ return '<li>'+escapeHtml(g)+'</li>'; }).join('') + '</ul></div>' : '';
      var unknown = dr.unknown && dr.unknown.length ? '<div class="ai-flag stop">The draft cites records that don’t exist ('+escapeHtml(dr.unknown.join(', '))+'). Remove or fix those sentences.</div>' : '';
      var pickOpen = recState.openEvidence[x.id];
      var picker = pickOpen ? renderEvidencePicker(x) : '';
      return '<div class="rec-dispute" data-did="'+escapeHtml(x.id)+'">'
        + '<div class="rec-d-head"><b>'+(x.invoice_id ? escapeHtml(invNo[x.invoice_id] || 'Invoice') : 'Whole account')+'</b><span class="muted small">'+escapeHtml(RAISED_VIA[x.raised_via] || x.raised_via)+(x.raised_on ? ' · ' + fmt(x.raised_on) : '')+'</span>'+status+'</div>'
        + '<div class="rec-d-says"><span>They say</span>'+escapeHtml(x.debtor_says)+'</div>'
        + '<label class="rec-f wide"><span>Our response (facts only, each linked to a record)</span><textarea data-dresp rows="6">'+escapeHtml(dr.text != null ? dr.text : (x.our_response || ''))+'</textarea></label>'
        + unknown + (ev ? '<div class="rec-evchips"><span class="muted small">Records cited:</span>'+ev+'</div>' : '') + gaps
        + '<div class="rec-acts">'
        + '<button class="btn ai-btn" type="button" data-dact="ai">'+AI_MARK+'Draft from our records with DebtJet AI</button>'
        + '<button class="btn ghost sm" type="button" data-dact="pick">Choose records'+(dr.keys ? ' ('+dr.keys.length+')' : '')+'</button>'
        + '<button class="btn" type="button" data-dact="save">Save</button>'
        + '<label class="rec-approve"><input type="checkbox" data-dact="approve"'+(x.approved_at ? ' checked' : '')+'> I’ve checked every statement against our records and approve this response</label>'
        + '<button class="btn ghost sm" type="button" data-dact="del">Delete</button></div>' + picker + '</div>';
    }).join('');
    return '<section class="card rec-disputes"><div class="card-head"><h3>Disputed facts</h3><span class="pill letter_sent">Beta</span></div><div class="card-body">'
      + '<p class="muted small">Record each point the debtor disputes and your response. “Draft from our records” writes a short factual response using only your invoices, payments, letters, correspondence and notes, with each fact linked to the record it came from. Anything your records don’t support is listed as missing instead of being written. It doesn’t give legal argument or advice. You edit it and approve it before it goes into the evidence pack.</p>'
      + (notesToImport.length ? '<div class="ai-flag info">'+notesToImport.length+' dispute'+(notesToImport.length > 1 ? 's' : '')+' found in your email notes. <button class="btn ghost sm" type="button" data-dact="import">Add to the register</button></div>' : '')
      + (list || '<p class="empty-note">No disputed points recorded for this case.</p>')
      + '<details class="rec-add"><summary class="btn sm">+ Add a disputed point</summary><div class="rec-row">'
      + '<label class="rec-f"><span>Invoice</span><select data-dn="invoice">'+invOpts('')+'</select></label>'
      + '<label class="rec-f"><span>Raised by</span><select data-dn="via">'+Object.keys(RAISED_VIA).map(function(k){ return '<option value="'+k+'">'+escapeHtml(RAISED_VIA[k])+'</option>'; }).join('')+'</select></label>'
      + '<label class="rec-f"><span>Date</span><input type="date" data-dn="on" value="'+isoLocal()+'"></label></div>'
      + '<label class="rec-f wide"><span>What the debtor says (in their words if possible)</span><textarea data-dn="says" rows="3"></textarea></label>'
      + '<div class="rec-acts"><button class="btn primary" type="button" data-dact="add">Add</button></div></details>'
      + '</div></section>';
  }

  function renderEvidencePicker(x){
    if(recState.evidenceErr) return '<div class="ai-flag caution">'+escapeHtml(recState.evidenceErr)+'</div>';
    if(!recState.evidence) return '<div class="muted small rec-pick">Loading records…</div>';
    var dr = recState.drafts[x.id] = recState.drafts[x.id] || {};
    var chosen = dr.keys || recState.evidence.map(function(e){ return e.key; });
    return '<div class="rec-pick"><div class="muted small">The draft may only use the records ticked here.</div>' + recState.evidence.map(function(e){
      return '<label><input type="checkbox" data-evk="'+escapeHtml(e.key)+'"'+(chosen.indexOf(e.key) >= 0 ? ' checked' : '')+'> <b>'+escapeHtml(e.key)+'</b> '+escapeHtml(String(e.text).slice(0, 160))+'</label>';
    }).join('') + '</div>';
  }

  async function ensureEvidenceList(){
    if(recState.evidence || recState.evidenceErr) return;
    var r = await invokeFn('dispute-response', { case_id: recState.caseId, list_only: true });
    if(r.ok) recState.evidence = r.all_evidence_keys || []; else recState.evidenceErr = r.error || 'Could not load records.';
    renderRecovery();
  }

  async function disputeAction(act, el){
    var box = el.closest('.rec-dispute'), id = box ? box.getAttribute('data-did') : null;
    var x = id ? recState.disputes.filter(function(d){ return d.id === id; })[0] : null;
    var c = recCase(), m = recMatter();
    if(act === 'add' || act === 'import'){
      var rows = [];
      if(act === 'add'){
        var card = el.closest('.rec-add'); var g = function(k){ return card.querySelector('[data-dn="'+k+'"]').value; };
        if(!g('says').trim()){ toast('Enter what the debtor says.'); return; }
        rows.push({ invoice_id: g('invoice') || null, raised_via: g('via'), raised_on: g('on') || null, debtor_says: g('says').trim().slice(0, 4000) });
      } else {
        recState.records.notes.filter(function(n){ return n.category === 'dispute' && !recState.disputes.some(function(d){ return d.debtor_says === (n.dispute_reason || n.summary); }); })
          .forEach(function(n){ rows.push({ invoice_id: n.invoice_id || null, raised_via: n.source === 'manual' ? 'other' : 'email', raised_on: String(n.occurred_at).slice(0, 10), debtor_says: String(n.dispute_reason || n.summary).slice(0, 4000) }); });
      }
      rows = rows.map(function(r){ return Object.assign(r, { org_id: currentOrg.id, case_id: c.id, matter_id: m ? m.id : null }); });
      var ins = await sb.from('recovery_disputes').insert(rows).select();
      if(ins.error){ toast('Could not add: ' + ins.error.message); return; }
      var newIds = (ins.data || []).map(function(d){ return d.id; }); recState.disputes = recState.disputes.filter(function(d){ return newIds.indexOf(d.id) < 0; }).concat(ins.data || []);
      toast(rows.length > 1 ? rows.length + ' disputed points added.' : 'Disputed point added.');
      renderRecovery(); return;
    }
    if(!x) return;
    var ta = box.querySelector('[data-dresp]');
    var dr = recState.drafts[x.id] = recState.drafts[x.id] || {};
    if(act === 'pick'){ recState.openEvidence[x.id] = !recState.openEvidence[x.id]; dr.text = ta.value; renderRecovery(); if(recState.openEvidence[x.id]) ensureEvidenceList(); return; }
    if(act === 'ai'){
      el.disabled = true; el.textContent = 'Drafting…';
      var r = await invokeFn('dispute-response', { case_id: c.id, invoice_id: x.invoice_id, debtor_says: x.debtor_says, evidence_keys: dr.keys || null });
      el.disabled = false; el.innerHTML = AI_MARK + 'Draft from our records with DebtJet AI';
      if(!r.ok){ toast(r.error || 'Could not draft a response.'); return; }
      var gaps = (r.draft.gaps || []).concat((r.draft.questions || []).map(function(q){ return 'Question: ' + q; }));
      var upd = await sb.from('recovery_disputes').update({ our_response: String(r.draft.response || '').slice(0, 6000), gaps: gaps, evidence: (r.evidence || []).slice(0, 40), ai_drafted: true, approved_at: null }).eq('id', x.id).select().maybeSingle();
      if(upd.error){ toast('Could not save the draft: ' + upd.error.message); return; }
      Object.assign(x, upd.data); dr.text = null; dr.unknown = r.unknown_citations || [];
      toast('Draft ready. Check each statement against the records cited, edit, then approve.');
      renderRecovery(); return;
    }
    if(act === 'save' || act === 'approve'){
      var text = ta.value.trim();
      var approving = act === 'approve' && el.checked;
      if(approving && !text){ el.checked = false; toast('Write or draft a response first.'); return; }
      var patch = { our_response: text || null };
      if(act === 'approve') patch.approved_at = approving ? new Date().toISOString() : null;
      var u = await sb.from('recovery_disputes').update(patch).eq('id', x.id).select().maybeSingle();
      if(u.error){ toast('Could not save: ' + u.error.message); return; }
      Object.assign(x, u.data); dr.text = null;
      toast(act === 'approve' ? (approving ? 'Response approved.' : 'Approval removed.') : (x.approved_at ? 'Saved.' : 'Saved. Approve it when you’ve checked it.'));
      renderRecovery(); return;
    }
    if(act === 'del'){
      if(!await djAsk('Delete this disputed point and its response?')) return;
      var dl = await sb.from('recovery_disputes').delete().eq('id', x.id);
      if(dl.error){ toast('Could not delete: ' + dl.error.message); return; }
      recState.disputes = recState.disputes.filter(function(d){ return d.id !== x.id; });
      renderRecovery();
    }
  }

  /* ---------- Saving the file ---------- */
  function readRecFields(){
    var o = {}; Array.prototype.forEach.call(document.querySelectorAll('#recRoot [data-rf]'), function(el){ o[el.getAttribute('data-rf')] = el.value; }); return o;
  }
  async function saveMatter(patch, msg){
    var m = recMatter(); if(!m) return false;
    var r = await sb.from('recovery_matters').update(patch).eq('id', m.id).select().maybeSingle();
    if(r.error){ toast('Could not save: ' + r.error.message); return false; }
    Object.assign(m, r.data || patch);
    if(msg) toast(msg);
    renderRecovery(); return true;
  }
  // The terms the claim's interest and fees rest on: document, acceptance, evidence, clauses and quotes.
  // Facts from the business's own records only. Saved into the claim snapshot when the claim is saved or lodged.
  function recTermsBasis(c, cl){
    var acc = acceptanceFor(c.debtor.id, false), any = acc || acceptanceFor(c.debtor.id, true);
    var d = any ? termsDocById(any.document_id) : null;
    if(!any || !d) return null;
    var L = d.limits || {}, I = L.interest || {}, E = L.evidence || {};
    var grp = any.group_id ? (stmtGroups.filter(function(g){ return g.id === any.group_id; })[0] || {}).name || 'a contact group' : null;
    var feeNames = {};
    cl.items.forEach(function(i){ (i.feeLines || []).forEach(function(f){ feeNames[String(f.name).toLowerCase()] = 1; }); });
    ((cl.lm.totals && cl.lm.totals.statement_fees) || []).forEach(function(f){ feeNames[String(f.name).toLowerCase()] = 1; });
    var quoteOf = function(e){ return e && e.quote ? { quote: String(e.quote).slice(0, 600), clause: e.clause || null, found: e.source === 'quote' || e.found === true } : null; };
    return {
      document: { id: d.id, title: d.title || 'Terms', kind: TERMS_KIND[d.kind] || d.kind || 'Document', confirmed_at: d.rules_confirmed_at || null },
      acceptance: { accepted_on: any.accepted_on, how: ACCEPT_HOW[any.accepted_how] || '', grade: any.evidence_grade || 'declared', via_group: grp, note: any.note || null },
      evidence: termsEvidence.filter(function(e){ return e.acceptance_id === any.id; }).map(function(e){
        return { source: EV_SOURCE[e.source] || e.source, label: evLabel(e), sha256: e.sha256 || null, link: e.external_url || null, verified: e.grade === 'verified' };
      }),
      interest: cl.interest > 0 && I.allowed ? { text: 'Up to ' + r2((I.max_rate_pa || 0) * 100) + '% a year, ' + (I.method === 'compound_monthly' ? 'compounding monthly' : 'simple'), clause: I.clause || null, from: quoteOf(E.rate) } : null,
      fees: cl.fees > 0 ? (L.fees || []).filter(function(f){ return feeNames[String(f.name).toLowerCase()]; }).map(function(f){
        return { name: f.name, text: limFeeText(f), clause: f.clause || null, from: quoteOf(E['fee:' + String(f.name).toLowerCase()]) };
      }) : []
    };
  }
  // Pack section: the terms behind the interest and fees claimed.
  function recTermsSection(cl, T){
    var charged = cl.interest > 0 || cl.fees > 0;
    if(!T) return charged ? '<div class="warn">Interest or fees are included in the amount claimed, but DebtJet has no terms document recorded as accepted by this customer.</div>' : '<p class="muted">No interest or fees are claimed. No terms document is recorded for this customer in DebtJet.</p>';
    var A = T.acceptance, rows = [];
    var cite = function(clause, from){ return (clause ? ' (' + escapeHtml(clauseLabel(clause)) + ')' : '') + (from && from.quote ? '<div class="muted">“' + escapeHtml(from.quote) + '”' + (from.clause && from.clause !== clause ? ' (' + escapeHtml(clauseLabel(from.clause)) + ')' : '') + '</div>' : ''); };
    rows.push(['Document', escapeHtml(T.document.title) + ' · ' + escapeHtml(T.document.kind)]);
    rows.push(['Accepted', escapeHtml(fmt(A.accepted_on)) + (A.how ? ' · ' + escapeHtml(A.how) : '') + (A.via_group ? ' · recorded for the contact group ' + escapeHtml(A.via_group) : '') + (A.note ? '<div class="muted">' + escapeHtml(A.note) + '</div>' : '')]);
    rows.push(['Evidence of acceptance', T.evidence.length ? T.evidence.map(function(e){ return escapeHtml(e.label) + (e.sha256 ? '<div class="muted">File fingerprint (SHA-256): ' + escapeHtml(String(e.sha256).slice(0, 16)) + '…</div>' : '') + (e.link ? '<div class="muted">' + escapeHtml(e.link) + '</div>' : ''); }).join('<br>') : 'None recorded in DebtJet']);
    if(T.interest) rows.push(['Interest claimed under', escapeHtml(T.interest.text) + cite(T.interest.clause, T.interest.from)]);
    T.fees.forEach(function(f){ rows.push([escapeHtml(f.name) + ' claimed under', escapeHtml(f.text) + cite(f.clause, f.from)]); });
    if(T.document.confirmed_at) rows.push(['Limits confirmed in DebtJet', escapeHtml(fmt(T.document.confirmed_at))]);
    return '<table><tbody>' + rows.map(function(r){ return '<tr><td style="width:180px;"><b>' + r[0] + '</b></td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>'
      + (charged && A.grade !== 'evidence' && A.grade !== 'verified' ? '<div class="warn">No evidence of acceptance is attached in DebtJet for these terms.</div>' : '')
      + '<p class="muted">Copies of the document and the evidence listed above are kept in DebtJet (Interest &amp; Fees → Terms &amp; rules).</p>';
  }
  function snapshotFor(c, cl, details){
    return { at: new Date().toISOString(), details: details, options: cl.opt, terms: recTermsBasis(c, cl),
      items: cl.items.map(function(i){ return { invoice_number: i.invoice_number, issued_date: i.issued_date, due_date: i.due_date, amount: i.amount, paid: i.paid, balance: i.balance, interest: cl.opt.include_interest ? i.interest : 0, fees: cl.opt.include_fees ? i.fees : 0, disputed: i.disputed }; }),
      totals: { principal: cl.principal, interest: cl.interest, fees: cl.fees, total: cl.total, filing_fee: cl.filingFee } };
  }
  async function caseEvent(c, type, title, body){
    await sb.from('case_events').insert({ org_id: currentOrg.id, case_id: c.id, event_type: type, title: title, body: body || null, created_by: session.user.id });
  }

  async function recoveryAction(act, el){
    var c = recCase(); if(!c) return;
    var m = recMatter(), jur = recJur(c, m), R = recRules(c, m);
    if(!R.live){ toast(jur + ' isn’t available yet.'); return; }
    var cl = recClaim(c, m);
    if(act === 'start'){
      var ins = await sb.from('recovery_matters').insert({ org_id: currentOrg.id, case_id: c.id, debtor_id: c.debtor.id, jurisdiction: jur, forum: R.forum, status: 'preparing', applicant: R.entityFees ? { entity: cl.entity } : {},
        principal: cl.principal, interest: cl.interest, fees: cl.fees, total_claimed: cl.total, filing_fee: cl.filingFee,
        claim_snapshot: snapshotFor(c, cl, recDefaultDetails(c, cl)), checklist: { options: cl.opt, items: {} } }).select().maybeSingle();
      if(ins.error){ toast('Could not start the file: ' + ins.error.message); return; }
      recMatters.unshift(ins.data);
      if(c.status !== 'tribunal' && c.status !== 'debt_recovery'){ await sb.from('cases').update({ status: 'debt_recovery' }).eq('id', c.id); c.status = 'debt_recovery'; }
      await caseEvent(c, 'recovery_file_started', 'Recovery file started (' + R.short + ')', 'Claim of ' + money(cl.total) + ' being prepared.');
      if(recState.disputes.length) await sb.from('recovery_disputes').update({ matter_id: ins.data.id }).eq('case_id', c.id).is('matter_id', null);
      toast('Recovery file started.'); renderRecoveryCaseOptions(); renderRecovery(); return;
    }
    if(!m) return;
    var f = readRecFields();
    if(act === 'save-app' || act === 'regen'){
      if(act === 'regen'){ var t = document.querySelector('#recRoot [data-rf="details"]'); if(t){ t.value = recDefaultDetails(c, cl); var rr = document.querySelector('#recRoot .rec-rich[data-rich-for="details"]'); if(rr) rr.innerHTML = djRich(t.value, {}, 'edit'); } toast('Details rebuilt from your records. Save to keep them.'); return; }
      var A = { entity: recEntity(m) }, P = {}; Object.keys(f).forEach(function(k){ if(k.indexOf('a.') === 0) A[k.slice(2)] = f[k].slice(0, 500); if(k.indexOf('p.') === 0) P[k.slice(2)] = f[k].slice(0, 500); });
      var ck = Object.assign({}, m.checklist || {}, { options: cl.opt, application_saved: true });
      var patch = { applicant: A, respondent: P, checklist: ck, claim_snapshot: Object.assign({}, m.claim_snapshot || {}, { details: String(f.details || '').slice(0, 8000) }) };
      if(m.status === 'preparing') Object.assign(patch, { principal: cl.principal, interest: cl.interest, fees: cl.fees, total_claimed: cl.total, filing_fee: cl.filingFee, claim_snapshot: snapshotFor(c, cl, String(f.details || '').slice(0, 8000)) });
      patch.claim_snapshot.sections = recSectionsFromForm(f);
      await saveMatter(patch, 'Application details saved.'); return;
    }
    if(act === 'copy-app'){
      var txt = recApplicationText(c, m, cl, f);
      try { await navigator.clipboard.writeText(txt); toast('Copied. Paste it wherever you need it.'); } catch(e){ toast('Copy failed. Use Print / PDF instead.'); }
      return;
    }
    if(act === 'print-app'){ recPrint(recApplicationHtml(c, m, cl, f)); return; }
    if(act === 'print-pack'){ recPrint(recPackHtml(c, m, cl)); return; }
    if(act === 'save-lodge'){
      if(!f.lodged_on){ toast('Enter the date you lodged.'); return; }
      var lp = { lodged_on: f.lodged_on, file_number: (f.file_number || '').trim() || null, filing_fee: f.filing_fee ? Number(f.filing_fee) : null };
      var first = !m.lodged_on;
      if(m.status === 'preparing') Object.assign(lp, { status: 'lodged', principal: cl.principal, interest: cl.interest, fees: cl.fees, total_claimed: cl.total, claim_snapshot: snapshotFor(c, cl, (m.claim_snapshot && m.claim_snapshot.details) || recDefaultDetails(c, cl)) });
      if(await saveMatter(lp, first ? 'Recorded as lodged.' : 'Updated.') && first){
        await sb.from('cases').update({ status: 'tribunal', tribunal_body: R.tribunalOption }).eq('id', c.id); c.status = 'tribunal';
        await caseEvent(c, 'tribunal_lodged', 'Application lodged with ' + R.short + (lp.file_number ? ' (' + lp.file_number + ')' : ''), R.claimLabel + ' of ' + money(m.total_claimed) + '.');
        renderRecoveryCaseOptions();
      }
      return;
    }
    if(act === 'save-serve'){
      if(!f.served_on){ toast('Enter the date the respondent was served.'); return; }
      var sp = { served_on: f.served_on, service_method: f.service_method || null, response_due: f.response_due || (recRespDays(R, c) ? addDaysIso(f.served_on, recRespDays(R, c)) : null) };
      if(m.status === 'lodged') sp.status = 'served';
      var firstServe = !m.served_on;
      if(await saveMatter(sp, sp.response_due ? 'Service recorded. Response due ' + fmt(sp.response_due) + '.' : 'Service recorded. Add the response date from ' + R.short + '’s orders.') && firstServe) await caseEvent(c, 'tribunal_served', 'Application served on the respondent', 'Served ' + fmt(f.served_on) + (f.service_method ? (f.service_method === 'tribunal' ? ' by ' + R.short : ' by ' + f.service_method.replace('_', ' ')) : '') + (sp.response_due ? '. Response due ' + fmt(sp.response_due) + '.' : '.'));
      return;
    }
    if(act === 'save-status'){
      var prev = m.status;
      var stp = { status: f.status, hearing_at: f.hearing_at ? new Date(f.hearing_at).toISOString() : null, outcome: (f.outcome || '').trim() || null };
      if(await saveMatter(stp, 'Saved.') && prev !== f.status){
        await caseEvent(c, 'recovery_status', 'Recovery file: ' + (REC_STATUS[f.status] || f.status), stp.outcome || '');
        if(f.status === 'paid' || f.status === 'closed'){ /* leave the case for the user to resolve from Debtors & Cases */ }
        renderRecoveryFiles();
      }
      return;
    }
    if(act === 'delete-file'){
      if(!await djAsk('Delete this recovery file? Disputed points stay on the case.')) return;
      var dl = await sb.from('recovery_matters').delete().eq('id', m.id);
      if(dl.error){ toast('Could not delete: ' + dl.error.message); return; }
      recMatters = recMatters.filter(function(x){ return x.id !== m.id; });
      toast('Recovery file deleted.'); renderRecoveryCaseOptions(); renderRecovery();
    }
  }

  /* ---------- Printing ---------- */
  function recSectionsFromForm(f){
    return Array.prototype.map.call(document.querySelectorAll('#recRoot .rec-sec'), function(el){ var id = el.getAttribute('data-secid'); return { title: String(f['sec.' + id + '.title'] || '').slice(0, 120), text: String(f['sec.' + id + '.text'] || '').slice(0, 6000) }; })
      .filter(function(x){ return x.title.trim() || x.text.trim(); }).slice(0, 12);
  }
  function recApplicationText(c, m, cl, f){
    var g = function(k){ return (f[k] || '').trim(); };
    return [
      cl.rules.short + ': ' + cl.rules.form, '',
      recTerms(cl.rules)[0].toUpperCase(), g('a.name'), g('a.abn') ? 'ABN ' + g('a.abn') : '', g('a.address'), g('a.phone'), g('a.email'), '',
      recTerms(cl.rules)[1].toUpperCase(), g('p.name') + (g('p.trading') ? ' (trading as ' + g('p.trading') + ')' : ''), g('p.abn') ? 'ABN ' + g('p.abn') : '', g('p.acn') ? 'ACN ' + g('p.acn') : '', g('p.address'), g('p.contact') ? 'Contact: ' + g('p.contact') : '', g('p.email'), g('p.phone'), '',
      'AMOUNT CLAIMED', 'Unpaid invoices: ' + money(cl.principal), 'Interest: ' + money(cl.interest), 'Fees: ' + money(cl.fees), 'Total: ' + money(cl.total), '',
      'DETAILS OF THE CLAIM', djPlain(g('details'))
    ].concat([].concat.apply([], recSectionsFromForm(f).map(function(x){ return ['', (x.title || 'Section').toUpperCase(), djPlain(x.text.trim())]; }))).filter(function(x, i, a){ return x !== '' || (a[i - 1] !== ''); }).join('\n');
  }
  var REC_PRINT_CSS = '<style>.rp{font-family:Inter,system-ui,sans-serif;color:#1b2433;font-size:12px;line-height:1.55;}.rp h1{font-size:20px;margin:0 0 4px;}.rp h2{font-size:14px;margin:22px 0 8px;padding-bottom:4px;border-bottom:2px solid #1f3a8a;}.rp .muted{color:#5b6474;}.rp table{width:100%;border-collapse:collapse;margin:6px 0;}.rp th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;background:#eef2f8;color:#14213d;padding:6px 7px;border-radius:0;}.rp td{padding:6px 7px;border-bottom:1px solid #e3e8ef;vertical-align:top;}.rp .num{text-align:right;white-space:nowrap;}.rp .box{border:1px solid #d9e0ea;border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-line;}.rp .two{display:grid;grid-template-columns:1fr 1fr;gap:14px;}.rp .pb{page-break-before:always;}.rp .cover{padding:30px 0 10px;}.rp .tot td{font-weight:700;border-top:2px solid #1f3a8a;}.rp .warn{background:#fff6e5;border:1px solid #f0d49b;border-radius:8px;padding:8px 10px;margin:8px 0;}.rp .box.rich{white-space:normal;}.rp .box.rich p,.rp .box.rich ul,.rp .box.rich ol{margin:0 0 8px;}.rp .box.rich ul,.rp .box.rich ol{padding-left:1.3em;}.rp .box.rich > :last-child{margin-bottom:0;}</style>';
  function recApplicationHtml(c, m, cl, f){
    var g = function(k){ return escapeHtml((f[k] || '').trim()); };
    return REC_PRINT_CSS + '<div class="rp"><h1>Information for '+escapeHtml(cl.rules.short)+': '+escapeHtml(cl.rules.form)+'</h1><div class="muted">Prepared '+fmt(new Date())+' from '+escapeHtml(currentOrg.name)+'’s records. Copy into '+escapeHtml(cl.rules.copyTarget)+', check, sign and lodge.</div>'
      + '<div class="two"><div><h2>'+cap1(recTerms(cl.rules)[0])+'</h2><div class="box">'+[g('a.name'), g('a.abn') ? 'ABN ' + g('a.abn') : '', g('a.address'), g('a.phone'), g('a.email')].filter(Boolean).join('\n')+'</div></div>'
      + '<div><h2>'+cap1(recTerms(cl.rules)[1])+'</h2><div class="box">'+[g('p.name') + (g('p.trading') ? ' (trading as ' + g('p.trading') + ')' : ''), g('p.abn') ? 'ABN ' + g('p.abn') : '', g('p.acn') ? 'ACN ' + g('p.acn') : '', g('p.address'), g('p.contact') ? 'Contact: ' + g('p.contact') : '', g('p.email'), g('p.phone')].filter(Boolean).join('\n')+'</div></div></div>'
      + '<h2>Amount claimed</h2>' + recAmountTable(cl)
      + '<h2>Details of the claim</h2><div class="box rich">'+djRich((f.details || '').trim(), {}, 'html')+'</div>'
      + recSectionsFromForm(f).map(function(x){ return '<h2>'+escapeHtml(x.title || 'Section')+'</h2><div class="box rich">'+djRich(x.text.trim(), {}, 'html')+'</div>'; }).join('')
      + '<h2>Before you lodge</h2><ul><li>Check every detail above against your records.</li><li>Attach or bring your evidence (see the evidence pack).</li><li>Pay the filing fee when you lodge (estimated '+(cl.filingFee != null ? money(cl.filingFee) : '—')+'; check '+escapeHtml(cl.rules.short)+'’s current fees).</li><li>'+(cl.rules.tribunalServes ? escapeHtml(cl.rules.short)+' serves the application by post unless you choose to serve it. Record the service date in DebtJet. ' : 'After lodging, serve a copy on the respondent and record the date in DebtJet. ')+escapeHtml(cl.rules.responseNote)+'</li></ul></div>';
  }
  function recAmountTable(cl){
    return '<table><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th class="num">Unpaid</th><th class="num">Interest</th><th class="num">Fees</th></tr></thead><tbody>'
      + cl.items.map(function(i){ return '<tr><td>'+escapeHtml(i.invoice_number)+'</td><td>'+fmt(i.issued_date)+'</td><td>'+fmt(i.due_date)+'</td><td class="num">'+money(i.balance)+'</td><td class="num">'+money(cl.opt.include_interest ? i.interest : 0)+'</td><td class="num">'+money(cl.opt.include_fees ? i.fees : 0)+'</td></tr>'; }).join('')
      + (cl.opt.include_fees && cl.fees > r2(cl.items.reduce(function(s, i){ return s + (Number(i.fees) || 0); }, 0)) ? '<tr><td colspan="5">Account fees</td><td class="num">'+money(r2(cl.fees - cl.items.reduce(function(s, i){ return s + (Number(i.fees) || 0); }, 0)))+'</td></tr>' : '')
      + '<tr class="tot"><td colspan="3">Subtotals</td><td class="num">'+money(cl.principal)+'</td><td class="num">'+money(cl.interest)+'</td><td class="num">'+money(cl.fees)+'</td></tr>'
      + (cl.abandoned ? '<tr><td colspan="5">Less amount abandoned to stay within the '+money(cl.rules.limit)+' limit</td><td class="num">−'+money(cl.abandoned)+'</td></tr>' : '')
      + '<tr class="tot"><td colspan="5">Total claimed</td><td class="num">'+money(cl.total)+'</td></tr></tbody></table>';
  }
  // How payments synced from Xero read in the chronology (method set by xero-sync).
  var REC_PAY_KIND = { payment: 'Payment received', credit_note: 'Credit note applied', prepayment: 'Prepayment applied', overpayment: 'Overpayment applied', adjustment: 'Paid or credited in Xero' };
  function recPackHtml(c, m, cl){
    var A = m.applicant || {}, P = m.respondent || {}, r = recState.records || { letters: [] };
    var who = escapeHtml(A.name || currentOrg.name) + ' v ' + escapeHtml(P.name || letterAddresseeName(c.debtor));
    var chron = recEvidenceList(c);
    var approved = recState.disputes.filter(function(x){ return x.approved_at && x.our_response; });
    var pending = recState.disputes.length - approved.length;
    var invNo = {}; (r.invoices || []).forEach(function(i){ invNo[i.id] = i.invoice_number; });
    // Once lodged, the pack shows the terms as they were when the claim was lodged.
    var terms = m.status !== 'preparing' && m.claim_snapshot && m.claim_snapshot.terms !== undefined ? m.claim_snapshot.terms : recTermsBasis(c, cl);
    var html = REC_PRINT_CSS + '<div class="rp"><div class="cover"><div class="muted">'+escapeHtml(cl.rules.bodyFull)+' · '+escapeHtml(cl.rules.kind)+'</div><h1>Evidence pack: '+who+'</h1>'
      + '<div class="muted">'+(m.file_number ? 'File ' + escapeHtml(m.file_number) + ' · ' : '')+'Prepared '+fmt(new Date())+' by the '+recTerms(cl.rules)[0]+' from its own records · Amount claimed '+money(m.status === 'preparing' ? cl.total : m.total_claimed)+'</div>'
      + '<h2>Contents</h2><ol><li>Details of the claim</li><li>Amount claimed</li><li>Terms and acceptance</li><li>Chronology</li><li>Disputed points and our response</li><li>Annexures: copies of letters sent ('+r.letters.length+')</li></ol></div>'
      + '<h2>1. Details of the claim</h2><div class="box">'+escapeHtml((m.claim_snapshot && m.claim_snapshot.details) || recDefaultDetails(c, cl))+'</div>'
      + '<h2>2. Amount claimed</h2>' + recAmountTable(cl)
      + '<h2>3. Terms and acceptance</h2>' + recTermsSection(cl, terms)
      + '<h2>4. Chronology</h2><table><thead><tr><th style="width:90px;">Date</th><th style="width:170px;">What</th><th>Details</th></tr></thead><tbody>'
      + chron.map(function(e){ return '<tr><td>'+fmt(e.at)+'</td><td>'+escapeHtml(e.kind)+'</td><td>'+escapeHtml(e.text)+'</td></tr>'; }).join('') + '</tbody></table>'
      + '<h2>5. Disputed points and our response</h2>'
      + (approved.length ? approved.map(function(x, n){ return '<div class="box"><b>Point '+(n + 1)+(x.invoice_id ? ' (' + escapeHtml(invNo[x.invoice_id] || 'invoice') + ')' : '')+'.</b> The '+recTerms(cl.rules)[1]+' says: '+escapeHtml(x.debtor_says)+'\n\n<b>Our response:</b> '+escapeHtml(x.our_response)+'</div>'; }).join('') : '<p class="muted">No disputed points recorded.</p>')
      + (pending ? '<div class="warn">'+pending+' disputed point'+(pending > 1 ? 's are' : ' is')+' not yet approved and '+(pending > 1 ? 'are' : 'is')+' left out of this pack.</div>' : '')
      + r.letters.map(function(l, n){ return '<div class="pb"><h2>Annexure A'+(n + 1)+': '+escapeHtml(TPL_LABEL[l.type] || 'Letter')+' sent '+fmt(l.sent_at)+'</h2>'+(l.snapshot && l.snapshot.html ? '<div>'+l.snapshot.html+'</div>' : '<p class="muted">No copy was kept of this letter.</p>')+'</div>'; }).join('')
      + '</div>';
    return html;
  }
  function recPrint(html){
    var box = document.getElementById('recPrint'); box.innerHTML = html;
    window.print();
  }

  /* ---------- Wiring ---------- */
  document.getElementById('recCaseSelect').addEventListener('change', function(){ selectRecoveryCase(this.value); });
  document.getElementById('recJurSelect').addEventListener('change', function(){ recState.jur = this.value; recState.forum = null; var m = recMatter(); if(m && m.jurisdiction !== this.value){ this.value = m.jurisdiction; toast('This file is for ' + m.jurisdiction + '. Delete it to start in another state.'); return; } renderRecovery(); });
  document.getElementById('recFiles').addEventListener('click', function(e){ var tr = e.target.closest('[data-rcase]'); if(tr){ var id = tr.getAttribute('data-rcase'); document.getElementById('recCaseSelect').value = id; recState.caseId = id; setRecTab(recBestTab(recMatters.filter(function(x){ return x.case_id === id; })[0])); selectRecoveryCase(id); } });
  /* ---------- Debt Recovery tabs ---------- */
  var recTab = 'cases', recCaseFilter = 'open', recCaseSearch = '';
  var REC_STEP_TABS = ['eligibility', 'claim', 'evidence', 'disputes', 'lodge', 'outcome'];
  function setRecTab(t){
    recTab = t; if(curView === 'recovery') setTimeout(shellRefresh, 0);
    var sec = document.querySelector('.view[data-view="recovery"]'); sec.setAttribute('data-rtab', t);
    Array.prototype.forEach.call(document.querySelectorAll('[data-rtab-btn]'), function(b){ var on = b.getAttribute('data-rtab-btn') === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    var panel = REC_STEP_TABS.indexOf(t) >= 0 ? 'work' : t;
    Array.prototype.forEach.call(document.querySelectorAll('[data-rtab-panel]'), function(p){ p.hidden = p.getAttribute('data-rtab-panel') !== panel; });
    if(t === 'audit'){
      var h = document.getElementById('hist-recovery'); if(!h.open) h.open = true;
      var c = recCase();
      document.getElementById('recAuditHint').textContent = c ? 'History and correspondence for ' + (c.debtor.name || 'this debtor') + '.' : 'Choose a case in the Cases tab to see its history.';
    }
    if(t === 'cases') renderRecoveryCaseList();
    else if(panel === 'work') renderRecovery();
  }
  function recBestTab(m){
    if(!m) return 'eligibility';
    if(m.status === 'preparing') return m.checklist && m.checklist.application_saved ? 'evidence' : 'claim';
    if(m.status === 'lodged') return 'lodge';
    return 'outcome';
  }
  function renderRecoveryCaseList(){
    var list = document.getElementById('recCaseList'); if(!list) return;
    var withFile = {}; recMatters.forEach(function(m){ withFile[m.case_id] = m; });
    var q = recCaseSearch.trim().toLowerCase();
    var rows = cases.filter(function(c){
      if(recCaseFilter === 'files') return !!withFile[c.id];
      if(recCaseFilter === 'open') return c.status !== 'resolved' || !!withFile[c.id];
      return true;
    }).filter(function(c){
      return !q || String(c.debtor.name || '').toLowerCase().indexOf(q) >= 0 || c.invoices.some(function(i){ return String(i.invoice_number || '').toLowerCase().indexOf(q) >= 0; });
    });
    list.innerHTML = rows.length ? rows.map(function(c){
      var m = withFile[c.id], n = c.invoices.length;
      return '<button type="button" class="ld-case' + (c.id === recState.caseId ? ' sel' : '') + '" data-rcasepick="' + escapeHtml(c.id) + '">'
        + '<span class="ld-case-main"><b>' + escapeHtml(c.debtor.name || '—') + '</b><span class="sub">' + n + ' invoice' + (n === 1 ? '' : 's') + (c.daysOverdue > 0 ? ' · oldest ' + c.daysOverdue + ' days overdue' : '') + (c.debtor.state ? ' · ' + escapeHtml(c.debtor.state) : '') + '</span>'
        + '<span class="sub">' + (m ? 'Recovery file: ' + escapeHtml(REC_STATUS[m.status] || m.status) + ' · ' + escapeHtml(m.jurisdiction) : 'No recovery file') + '</span></span>'
        + '<span class="ld-case-side"><b>' + money(c.total) + '</b>' + pill(c.status) + '</span></button>';
    }).join('') : '<div class="empty-note">No cases match.</div>';
    renderRecoveryCaseCard();
  }
  function renderRecoveryCaseCard(){
    var box = document.getElementById('recCaseCard'), c = recCase();
    document.getElementById('recCaseNow').textContent = c ? (c.debtor.name || '—') + ' · ' + money(c.total) : 'No case selected';
    if(!box) return;
    if(!c){ box.innerHTML = '<p class="muted small">Choose a case on the left.</p>'; return; }
    var m = recMatter(), R = recRules(c, m), jur = recJur(c, m);
    box.innerHTML = '<ul class="sel-names"><li>' + escapeHtml(c.debtor.name || '—') + '</li></ul>'
      + '<div class="sel-total"><span>Owing</span><b>' + money(c.total) + '</b></div>'
      + '<p class="muted small">' + c.invoices.length + ' open invoice' + (c.invoices.length === 1 ? '' : 's') + (c.daysOverdue > 0 ? ' · oldest ' + c.daysOverdue + ' days overdue' : '') + '<br>'
      + (m ? 'Recovery file: <b>' + escapeHtml(REC_STATUS[m.status] || m.status) + '</b> in ' + escapeHtml(R ? R.short : jur) : 'Forum: ' + escapeHtml(jur) + (R ? ' · ' + escapeHtml(R.short) : '') + ' (based on the debtor’s state; you can change it)') + '</p>'
      + '<button class="btn primary" type="button" data-rtab-go="' + recBestTab(m) + '">' + (m ? 'Continue the file →' : 'Check eligibility →') + '</button>';
  }
  function renderRecTabBadges(info){
    var set = function(k, txt, cls){ var el = document.querySelector('[data-rbadge="' + k + '"]'); if(!el) return; el.textContent = txt || ''; el.className = 'rtab-b' + (cls ? ' ' + cls : ''); };
    if(!info){ REC_STEP_TABS.forEach(function(k){ set(k, ''); }); return; }
    set('eligibility', info.stops ? String(info.stops) : '✓', info.stops ? 'warn' : 'ok');
    set('claim', info.st(3) === 'done' ? '✓' : '', 'ok');
    set('evidence', info.st(4) === 'done' ? '✓' : '', 'ok');
    set('disputes', info.openDisputes ? String(info.openDisputes) : '', 'n');
    set('lodge', info.st(6) === 'done' ? '✓' : info.st(5) === 'done' ? '½' : '', 'ok');
    set('outcome', info.m && info.m.outcome ? '✓' : '', 'ok');
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-rtab-btn]'), function(b){ b.addEventListener('click', function(){ setRecTab(this.getAttribute('data-rtab-btn')); }); });
  document.getElementById('recCaseFilter').addEventListener('change', function(){ recCaseFilter = this.value; renderRecoveryCaseList(); });
  document.getElementById('recCaseSearch').addEventListener('input', function(){ recCaseSearch = this.value; renderRecoveryCaseList(); });
  document.addEventListener('click', function(e){
    var g = e.target.closest('[data-rtab-go]'); if(g){ setRecTab(g.getAttribute('data-rtab-go')); window.scrollTo(0, 0); return; }
    var c = e.target.closest('[data-rcasepick]');
    if(c){ var id = c.getAttribute('data-rcasepick'); document.getElementById('recCaseSelect').value = id; selectRecoveryCase(id).then(renderRecoveryCaseList); renderRecoveryCaseList(); }
  });

  document.getElementById('recRoot').addEventListener('click', async function(e){
    var b = e.target.closest('[data-ract]'); if(b){ recoveryAction(b.getAttribute('data-ract'), b); return; }
    if(e.target.id === 'recStartBtn'){ recoveryAction('start', e.target); return; }
    var addSec = e.target.closest('[data-raddsec]');
    if(addSec){
      var c0 = recCase(), box = document.getElementById('recSecs'); if(!c0 || !box) return;
      if(box.children.length >= 12){ toast('Up to 12 extra sections.'); return; }
      var cl0 = recClaim(c0, recMatter());
      box.insertAdjacentHTML('beforeend', recSectionHtml(recSectionPreset(addSec.getAttribute('data-raddsec'), c0, cl0), 'n' + (++recSecSeq)));
      attachRecRich(document.getElementById('recRoot'));
      var last = box.lastElementChild; last.scrollIntoView({ block: 'center', behavior: 'smooth' }); (last.querySelector('.rec-sec-title').value ? last.querySelector('.rec-rich') : last.querySelector('.rec-sec-title')).focus();
      return;
    }
    var sa = e.target.closest('[data-rsec]');
    if(sa){
      var sec = sa.closest('.rec-sec'), how = sa.getAttribute('data-rsec');
      if(how === 'del'){ var par = sec.parentNode, nxt = sec.nextSibling, ttl = (sec.querySelector('.rec-sec-title') || {}).value || 'Section'; sec.remove(); toastUndo('“' + ttl + '” removed. Save to keep the change.', function(){ par.insertBefore(sec, nxt && nxt.parentNode === par ? nxt : null); }); }
      if(how === 'up' && sec.previousElementSibling) sec.parentNode.insertBefore(sec, sec.previousElementSibling);
      if(how === 'down' && sec.nextElementSibling) sec.parentNode.insertBefore(sec.nextElementSibling, sec);
      return;
    }
    var d = e.target.closest('[data-dact]'); if(d && d.getAttribute('data-dact') !== 'approve'){ disputeAction(d.getAttribute('data-dact'), d); }
  });
  document.getElementById('recRoot').addEventListener('change', function(e){
    var o = e.target.getAttribute('data-ropt');
    if(o){
      var m = recMatter(), c = recCase();
      var opts = Object.assign({}, recClaim(c, m).opt); opts[o] = e.target.checked;
      if(m){ m.checklist = Object.assign({}, m.checklist || {}, { options: opts }); saveMatter({ checklist: m.checklist }); }
      else { recState.options = opts; renderRecovery(); }
      return;
    }
    if(e.target.hasAttribute('data-rforum')){ recState.forum = e.target.getAttribute('data-rforum'); recState.options = null; renderRecovery(); return; }
    if(e.target.hasAttribute('data-rentity')){
      var me = recMatter();
      if(me){ me.applicant = Object.assign({}, me.applicant || {}, { entity: e.target.value }); saveMatter({ applicant: me.applicant }); }
      else { recState.entity = e.target.value; renderRecovery(); }
      return;
    }
    var k = e.target.getAttribute('data-rck');
    if(k){ var mm = recMatter(); var items = Object.assign({}, (mm.checklist && mm.checklist.items) || {}); items[k] = e.target.checked; saveMatter({ checklist: Object.assign({}, mm.checklist || {}, { items: items }) }); return; }
    var ev = e.target.getAttribute('data-evk');
    if(ev){
      var did = e.target.closest('.rec-dispute').getAttribute('data-did');
      var dr = recState.drafts[did] = recState.drafts[did] || {};
      var keys = dr.keys || recState.evidence.map(function(x){ return x.key; });
      keys = e.target.checked ? keys.concat([ev]).filter(function(v, i, a){ return a.indexOf(v) === i; }) : keys.filter(function(x){ return x !== ev; });
      dr.keys = keys; var btn = e.target.closest('.rec-dispute').querySelector('[data-dact="pick"]'); if(btn) btn.textContent = 'Choose records (' + keys.length + ')';
      return;
    }
    if(e.target.getAttribute('data-dact') === 'approve') disputeAction('approve', e.target);
  });
  initHistoryPanel('recovery');


  document.getElementById('checkAllAbnsBtn').addEventListener('click', function(){ checkAllAbns(this); });
  /* -- import -- */
  document.getElementById('stmtFilter').addEventListener('change', function(){
    stmtFilter = this.value;
    stmtInvoiceOverride = {};  // re-tick invoices to suit the new filter
    renderStatementContacts();
  });
  document.getElementById('stmtSearch').addEventListener('input', function(){ stmtSearch = this.value; renderStatementContacts(); });
  document.getElementById('stmtSearch').addEventListener('focus', function(){ var had = !!qfPeople; qfLoadPeople().then(function(){ if(!had && stmtSearch) renderStatementContacts(); }); });
  document.getElementById('stmtClearSel').addEventListener('click', function(){ stmtSelectedDebtors = {}; stmtInvoiceOverride = {}; renderStatementContacts(); });
  document.getElementById('stmtShowMode').addEventListener('change', function(){ stmtShowMode = this.value; renderStatementContacts(); });
  [['stmtTickAllInv', true], ['stmtUntickAllInv', false]].forEach(function(p){ document.getElementById(p[0]).addEventListener('click', function(){
    var ids = Object.keys(stmtSelectedDebtors).filter(function(k){ return stmtSelectedDebtors[k]; });
    if(!ids.length){ toast('Tick a contact first.'); return; }
    stmtDebtors.forEach(function(d){ if(ids.indexOf(d.id) >= 0) d.invoices.forEach(function(i){ if(!i.fullyPaid) stmtInvoiceOverride[i.id] = p[1]; }); });
    renderStatementContacts();
  }); });
  document.getElementById('stmtCsvTemplate').addEventListener('click', function(){
    var csv = 'debtor_name,debtor_type,abn,contact_name,email,phone,invoice_number,description,amount,issued_date,due_date\n'
      + 'Example Pty Ltd,company,12345678901,Jane Citizen,accounts@example.com,0412345678,INV-1001,Website build,1650.00,2026-10-01,2026-10-31\n'
      + 'Jordan Citizen,individual,,Jordan,jordan@example.com,0412345679,INV-1002,Bathroom repair,880.00,2026-10-05,2026-11-04\n';
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'debtjet-invoice-import-template.csv'; a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  });
  document.getElementById('stmtImportCsvBtn').addEventListener('click', function(){ closeModal(document.getElementById('srcModal')); document.getElementById('stmtCsvInput').click(); });

  function parseCsv(text){
    var rows = [], row = [], field = '', inQuotes = false;
    for(var i=0;i<text.length;i++){
      var ch = text[i];
      if(inQuotes){
        if(ch === '"'){ if(text[i+1] === '"'){ field += '"'; i++; } else inQuotes = false; }
        else field += ch;
      } else {
        if(ch === '"') inQuotes = true;
        else if(ch === ','){ row.push(field); field = ''; }
        else if(ch === '\n' || ch === '\r'){ if(ch === '\r' && text[i+1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
        else field += ch;
      }
    }
    if(field.length || row.length){ row.push(field); rows.push(row); }
    return rows.filter(function(r){ return r.length > 1 || (r.length === 1 && r[0].trim() !== ''); });
  }
  document.getElementById('stmtCsvInput').addEventListener('change', async function(e){
    var file = e.target.files[0]; if(!file) return;
    var text = await file.text();
    var rows = parseCsv(text);
    if(rows.length < 2){ toast('No data rows found in that CSV.'); this.value=''; return; }
    var header = rows[0].map(function(h){ return h.trim().toLowerCase(); });
    var dataRows = rows.slice(1).filter(function(r){ return r.some(function(c){ return c && c.trim(); }); });
    var idx = function(name){ return header.indexOf(name); };
    var iName = idx('debtor_name'), iKind = idx('debtor_type'), iAbn = idx('abn'), iContact = idx('contact_name'), iEmail = idx('email'), iPhone = idx('phone'),
        iInvNum = idx('invoice_number'), iDesc = idx('description'), iAmount = idx('amount'), iIssued = idx('issued_date'), iDue = idx('due_date');
    if(iName < 0 || iAmount < 0 || iDue < 0){ toast('CSV needs at least debtor_name, amount and due_date columns.'); this.value=''; return; }
    var imported = 0, failed = 0;
    for(var r=0; r<dataRows.length; r++){
      var row = dataRows[r];
      var name = (row[iName]||'').trim();
      if(!name){ continue; }
      try{
        var debtorId;
        var existing = await sb.from('debtors').select('id').eq('org_id', currentOrg.id).ilike('name', name).limit(1).maybeSingle();
        if(existing.data){ debtorId = existing.data.id; }
        else {
          var csvKind = iKind>=0 ? kindFromCsv(row[iKind]) : null;
          var insD = await sb.from('debtors').insert({ org_id: currentOrg.id, name: name, debtor_kind: csvKind, abn: (iAbn>=0 && csvKind !== 'individual') ? ((row[iAbn]||'').replace(/\D/g,'')||null) : null, contact_name: iContact>=0?(row[iContact]||null):null, email: iEmail>=0?(row[iEmail]||null):null, phone: iPhone>=0?(row[iPhone]||null):null }).select('id').single();
          if(insD.error) throw insD.error;
          debtorId = insD.data.id;
        }
        var caseId;
        var existingCase = await sb.from('cases').select('id').eq('org_id', currentOrg.id).eq('debtor_id', debtorId).neq('status','resolved').limit(1).maybeSingle();
        if(existingCase.data){ caseId = existingCase.data.id; }
        else {
          var insC = await sb.from('cases').insert({ org_id: currentOrg.id, debtor_id: debtorId, status: 'new', interest_rate: 0.10 }).select('id').single();
          if(insC.error) throw insC.error;
          caseId = insC.data.id;
        }
        var amt = parseFloat((row[iAmount]||'0').replace(/[^0-9.\-]/g,''));
        var insI = await sb.from('invoices').insert({
          org_id: currentOrg.id, debtor_id: debtorId, case_id: caseId,
          invoice_number: iInvNum>=0 ? (row[iInvNum]||('IMP-'+(r+1))) : ('IMP-'+(r+1)),
          description: iDesc>=0 ? (row[iDesc]||null) : null,
          amount: isNaN(amt)?0:amt, issued_date: iIssued>=0 ? (row[iIssued]||null) : null,
          due_date: row[iDue], status: 'open', source: 'csv_import'
        });
        if(insI.error) throw insI.error;
        imported++;
      } catch(err){ failed++; }
    }
    this.value = '';
    toast('Imported ' + imported + ' invoice row(s)' + (failed ? (', ' + failed + ' failed') : '') + '.');
    await loadCases();
    await loadStatementsData();
    renderDashboard();
    renderCasesTable('all');
    renderStatementContacts();
  });

