import Coupon from '../models/Coupon.js';

/** Two sample coupons so checkout has something to try. Idempotent. */
const seedCoupons = async () => {
  if ((await Coupon.countDocuments()) > 0) return;

  await Coupon.create([
    {
      code: 'WELCOME10',
      description: '10% off your order, up to ₹2,000',
      type: 'percent',
      value: 10,
      maxDiscount: 2000,
      minOrder: 999,
    },
    {
      code: 'FLAT500',
      description: '₹500 off orders above ₹5,000',
      type: 'flat',
      value: 500,
      minOrder: 5000,
      usageLimit: 100,
    },
  ]);
  console.log('Sample coupons seeded: WELCOME10, FLAT500');
};

export default seedCoupons;
