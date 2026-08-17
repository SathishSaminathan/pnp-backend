const quotes = new Map();
const orders = new Map();

const saveQuote = quote => {
  quotes.set(quote.quoteId, { ...quote, createdAt: Date.now() });
  return quote;
};

const getQuote = quoteId => quotes.get(quoteId);

const saveOrder = order => {
  orders.set(order.orderId, { ...order, createdAt: Date.now() });
  return order;
};

const getOrder = orderId => orders.get(orderId);

module.exports = { saveQuote, getQuote, saveOrder, getOrder };
