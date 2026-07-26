function doGet() {
  const config = getRuntimeConfig_();
  const template = HtmlService.createTemplateFromFile('Index');
  template.appName = config.appName;
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
