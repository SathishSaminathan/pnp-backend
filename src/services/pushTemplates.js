const interpolate = (template, vars = {}) =>
  String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] == null ? '' : String(vars[key])));

const TEMPLATES = [
  {
    id: 'broadcast',
    name: 'General announcement',
    description: 'Send to every device subscribed to pnp_broadcast',
    audience: 'all',
    actionType: 'BROADCAST',
    title: 'PNP update',
    body: 'We have a new update for you on PNP.',
  },
  {
    id: 'promo',
    name: 'Promo',
    description: 'Offers and discounts',
    audience: 'all',
    actionType: 'PROMO',
    title: 'Offer on PNP',
    body: 'A limited-time offer is live. Open the app to see nearby restrooms.',
  },
  {
    id: 'whats_new',
    name: "What's new",
    description: 'Feature announcement',
    audience: 'all',
    actionType: 'WHATS_NEW',
    title: "What's new in PNP",
    body: 'We shipped improvements to discovery and bookings. Take a look in the app.',
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    description: 'Shows the in-app maintenance notice',
    audience: 'all',
    actionType: 'MAINTENANCE',
    title: 'Scheduled maintenance',
    body: 'PNP will be briefly unavailable. Thanks for your patience.',
  },
  {
    id: 'alert',
    name: 'Service alert',
    description: 'Urgent notice to all users',
    audience: 'all',
    actionType: 'ALERT',
    title: 'Important notice',
    body: 'Please open PNP for an important service update.',
  },
  {
    id: 'custom',
    name: 'Custom message',
    description: 'Write your own title and body',
    audience: 'all',
    actionType: 'CUSTOM',
    title: '',
    body: '',
  },
  {
    id: 'account_blocked',
    name: 'Account blocked',
    description: 'Sent automatically when an admin blocks a user',
    audience: 'user',
    actionType: 'ACCOUNT_BLOCKED',
    title: 'Account blocked',
    body: 'Hi {{name}}, your PNP account has been blocked{{reason}} You can contact support if this is a mistake.',
  },
  {
    id: 'account_enabled',
    name: 'Account restored',
    description: 'Sent automatically when an admin unblocks a user',
    audience: 'user',
    actionType: 'ACCOUNT_ENABLED',
    title: 'Account restored',
    body: 'Hi {{name}}, your PNP account is active again. You can continue using the app.',
  },
];

const getTemplate = id => TEMPLATES.find(item => item.id === id) || null;

const applyTemplate = (id, vars = {}) => {
  const template = getTemplate(id);
  if (!template) return null;
  return {
    ...template,
    title: interpolate(template.title, vars),
    body: interpolate(template.body, vars),
  };
};

const listPublicTemplates = () =>
  TEMPLATES.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    audience: item.audience,
    actionType: item.actionType,
    title: item.title,
    body: item.body,
  }));

module.exports = { TEMPLATES, getTemplate, applyTemplate, listPublicTemplates, interpolate };
