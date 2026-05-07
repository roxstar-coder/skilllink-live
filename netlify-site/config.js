(function () {
  const localApiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://skilllink-live.onrender.com';

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
