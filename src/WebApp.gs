function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Open Travel CRM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getBootstrap(token) {
  const user = requireUser_(token, ['ADMIN', 'AGENT']);
  return {
    ok: true,
    version: OTC.VERSION,
    user: publicUser_(user),
    options: OTC.OPTIONS,
    agents: user.role === 'ADMIN' ? listAgentEmails_() : [],
    today: dateToIso_(new Date())
  };
}
