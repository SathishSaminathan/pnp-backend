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

const isFailedMoneyStatus = value => String(value || '').toUpperCase() === 'FAILED';

const publicTransaction = item => {
  const failed = isFailedMoneyStatus(item.paymentStatus) || isFailedMoneyStatus(item.settlementStatus);
  return {
    ...item,
    paymentStatus: failed ? 'FAILED' : 'PAID',
    settlementStatus: failed ? 'FAILED' : 'SETTLED',
  };
};

const publicBooking = item => {
  const paymentFailed = isFailedMoneyStatus(item.paymentStatus);
  const cancelled = String(item.bookingStatus || '').toUpperCase() === 'CANCELLED';
  return {
    ...item,
    paymentStatus: paymentFailed ? 'FAILED' : 'PAID',
    bookingStatus: cancelled ? 'CANCELLED' : paymentFailed ? 'CANCELLED' : 'COMPLETED',
  };
};

module.exports = { saveQuote, getQuote, saveOrder, getOrder, publicTransaction, publicBooking };
