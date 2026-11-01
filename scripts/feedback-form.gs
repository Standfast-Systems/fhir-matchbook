/**
 * Creates FHIR Matchbook's feedback form (src/app/repo.ts FEEDBACK_URL) in your Google account,
 * with a Sheet that collects the responses. Run it once:
 *
 *   1. Go to https://script.google.com and choose New project.
 *   2. Replace everything in the editor with this file, save, and run createFeedbackForm.
 *   3. Allow it to manage your forms and spreadsheets when Google asks.
 *   4. Open the execution log: it prints the form's short link, its edit link, and links that
 *      pre-tick one section, for the site to use.
 *
 * Nobody needs to sign in to answer, and no email addresses are collected unless people leave one
 * in the last question. On a company Google Workspace, answers from outside the company also need
 * the domain's admin to allow forms to be shared externally.
 */
function createFeedbackForm() {
  const form = FormApp.create('FHIR Matchbook feedback')
    .setDescription(
      'FHIR Matchbook is early, and your feedback shapes what comes next. It takes about two ' +
        'minutes. https://standfast-systems.github.io/fhir-matchbook/',
    )
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setAllowResponseEdits(false)
    .setProgressBar(false)
    .setConfirmationMessage('Thank you. Every answer gets read.');
  try {
    form.setRequireLogin(false); // Google Workspace only: let people outside the company answer.
  } catch (e) {
    // A personal Gmail account has no such setting; anyone with the link can answer already.
  }

  const sections = ['Browsr (find guides and resources)', 'Mappr (lookup and patterns)', 'Initializr (start a project)'];
  const used = form
    .addCheckboxItem()
    .setTitle('Which part did you use?')
    .setChoiceValues(sections)
    .setRequired(true);
  form
    .addTextItem()
    .setTitle('What were you trying to do?')
    .setHelpText('For example: find which guides a payer has to support, or set up a SMART app.');
  form
    .addMultipleChoiceItem()
    .setTitle('Did it get you there?')
    .setChoiceValues(['Yes', 'Partly', 'No']);
  form.addParagraphTextItem().setTitle('What was wrong, missing or confusing?');
  form.addParagraphTextItem().setTitle("Anything you'd want it to do next?");
  form
    .addTextItem()
    .setTitle('Can we follow up with you?')
    .setHelpText('Leave an email if so. Optional.');

  const sheet = SpreadsheetApp.create('FHIR Matchbook feedback (responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  const url = form.getPublishedUrl();
  Logger.log('Short link (for FEEDBACK_URL): ' + form.shortenFormUrl(url));
  Logger.log('Edit the form:   ' + form.getEditUrl());
  Logger.log('Responses sheet: ' + sheet.getUrl());
  sections.forEach((s) => {
    const prefilled = form
      .createResponse()
      .withItemResponse(used.createResponse([s]))
      .toPrefilledUrl();
    Logger.log('Pre-ticked "' + s + '": ' + prefilled);
  });
}
