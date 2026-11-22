// Text shown for profile ids and dates

// dd.mm.yy or dd.mm.yyyy, depending on `year` ('2-digit' or 'numeric')
const toDottedDate = (value, year) =>
  new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year }).replace(/\//g, '.');

// "1KGZ" and the first 8 characters of the user id; a fixed placeholder without an id
export const formatProfileId = (id) => (id ? `1KGZ${id.substring(0, 8)}` : '1KGZ123');

// dd.mm.yy; a fixed placeholder without a date
export const formatJoinDate = (createdAt) => (createdAt ? toDottedDate(createdAt, '2-digit') : '14.11.25');

// dd.mm.yyyy
export const formatCardDate = (createdAt) => toDottedDate(createdAt, 'numeric');
