(function () {
  const localApiBase = 'http://localhost:5000';

  window.SKILLLINK_CONFIG = {
    API_BASE_URL: localApiBase
  };

  window.getSkillLinkApiBase = function getSkillLinkApiBase() {
    return (window.SKILLLINK_CONFIG?.API_BASE_URL || localApiBase).replace(/\/$/, '');
  };

  window.buildSkillLinkApiUrl = function buildSkillLinkApiUrl(endpoint) {
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${window.getSkillLinkApiBase()}/api${normalizedEndpoint}`;
  };
}());
