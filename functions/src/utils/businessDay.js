// Japanese stores: a business day switches at 00:00 Asia/Tokyo (UTC+09:00).
const businessDay = (date = new Date()) =>
  new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
module.exports = { businessDay };
