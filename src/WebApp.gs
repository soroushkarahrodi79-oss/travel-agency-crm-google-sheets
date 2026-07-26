function doGet() {
  const config = getRuntimeConfig_();
  const template = HtmlService.createTemplateFromFile('Index');
  template.appName = config.appName;
  template.environment = config.environment;
  template.language = messageLanguage_(config.locale);
  // The catalogue travels in an HTML-escaped data attribute rather than an
  // inline script, so the Web App's only script block stays parseable as plain
  // JavaScript. It ships with the first paint, so the sign-in screen is
  // translated before any authenticated call happens.
  template.messages = JSON.stringify(uiMessages_());
  return template.evaluate()
    .setTitle(config.appName)
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
    assignableUsers: user.role === 'ADMIN' ? listAssignableUsers_() : [],
    configuration: getRuntimeConfig_(),
    capabilities: {
      manageUsers: user.role === 'ADMIN'
    },
    today: dateToIso_(new Date())
  };
}
