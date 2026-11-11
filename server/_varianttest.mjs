/**
 * Sizes and colours: choosing one, stock per option, racing for the last
 * pair in a size, cancelling, and admin edits while orders come in.
 * Run with: npm run test:variants
 */
process.env.REQUIRE_EMAIL_VERIFICATION ??= 'false';
import { startHarness, ADDRESS } from './_harness.mjs';
import Product from './src/models/Product.js';
import Category from './src/models/Category.js';
import { outbox } from './src/services/email.service.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();
await register('ann');
await register('ben');
const footwear = await Category.findOne({ name: 'Footwear' });

console.log('--- admin creates a shoe with sizes ---');
let r = await call('sa', 'POST', '/api/products', {
  name: 'Trail Runner', brand: 'Stride', description: 'A light trail shoe', price: 2500, mrp: 3000,
  category: footwear._id, optionName: 'Size',
  variants: [{ label: 'UK 7', stock: 3 }, { label: 'UK 8', stock: 1 }, { label: 'UK 9', stock: 0 }],
});
expect('product with sizes created', r.status, 201, `"${r.body.message}"`);
const shoe = r.body.product;
expect('total stock is the sum of the sizes', shoe?.stock, 4);
r = await call('sa', 'POST', '/api/products', {
  name: 'Bad Sizes', brand: 'X', description: 'x', price: 10, mrp: 10, category: footwear._id,
  variants: [{ label: 'M', stock: 1 }, { label: 'm', stock: 2 }],
});
expect('the same size twice is refused', r.status, 400, `"${r.body.message}"`);
r = await call('sa', 'POST', '/api/products', {
  name: 'Bad Stock', brand: 'X', description: 'x', price: 10, mrp: 10, category: footwear._id,
  variants: [{ label: 'M', stock: 'lots' }],
});
expect('a size with non-numeric stock is refused', r.status, 400, `"${r.body.message}"`);

console.log('\n--- shopping with sizes ---');
r = await call('ann', 'POST', '/api/cart', { productId: shoe._id, quantity: 1 });
expect('adding without choosing a size is refused', r.status, 400, `"${r.body.message}"`);
r = await call('ann', 'POST', '/api/cart', { productId: shoe._id, quantity: 1, variant: 'UK 12' });
expect('a size that does not exist is refused', r.status, 400);
r = await call('ann', 'POST', '/api/cart', { productId: shoe._id, quantity: 1, variant: 'UK 9' });
expect('a sold-out size is refused', r.status, 409, `"${r.body.message}"`);
r = await call('ann', 'POST', '/api/cart', { productId: shoe._id, quantity: 4, variant: 'UK 7' });
expect('more than that size has is refused', r.status, 409);
r = await call('ann', 'POST', '/api/cart', { productId: shoe._id, quantity: 2, variant: 'UK 7' });
expect('two pairs of UK 7 added', r.status, 200);
r = await call('ann', 'POST', '/api/cart', { productId: shoe._id, quantity: 1, variant: 'UK 8' });
expect('UK 8 is a separate line', r.body.cart?.items?.length, 2);
expect('  each line knows its size and stock', r.body.cart?.items?.map((i) => `${i.variant}:${i.maxAvailable}`).join(','), 'UK 7:3,UK 8:1');
r = await call('ann', 'PATCH', `/api/cart/${shoe._id}?variant=${encodeURIComponent('UK 7')}`, { quantity: 3 });
expect('quantity of one size can be changed', r.body.cart?.items?.find((i) => i.variant === 'UK 7')?.quantity, 3);
r = await call('ann', 'DELETE', `/api/cart/${shoe._id}?variant=${encodeURIComponent('UK 7')}`);
expect('removing one size keeps the other', r.body.cart?.items?.map((i) => i.variant).join(','), 'UK 8');

console.log('\n--- two shoppers, one pair of UK 8 left ---');
await call('ben', 'POST', '/api/cart', { productId: shoe._id, quantity: 1, variant: 'UK 8' });
const race = await Promise.all(['ann', 'ben'].map((who) =>
  call(who, 'POST', '/api/orders', { shippingAddress: ADDRESS, paymentMethod: 'cod' })));
expect('exactly one gets it', race.filter((x) => x.status === 201).length, 1);
expect('the other is told that size sold out', race.filter((x) => x.status === 409).length, 1);
let fresh = await Product.findById(shoe._id);
expect('UK 8 is now 0', fresh.variants.find((v) => v.label === 'UK 8').stock, 0);
expect('total went down by one', fresh.stock, 3);
const won = race.find((x) => x.status === 201).body.order;
expect('the order line records the size', `${won.items[0].optionName}: ${won.items[0].variant}`, 'Size: UK 8');
const mail = outbox.find((m) => m.subject === `Order ${won.orderNumber} placed`);
expect('the order email shows the size', mail?.text.includes('(Size: UK 8)'), true);

console.log('\n--- cancelling puts the pair back in its size ---');
const winner = race[0].status === 201 ? 'ann' : 'ben';
r = await call(winner, 'PATCH', `/api/orders/${won._id}/cancel`);
fresh = await Product.findById(shoe._id);
expect('UK 8 back to 1', fresh.variants.find((v) => v.label === 'UK 8').stock, 1);
expect('total back to 4', fresh.stock, 4);

console.log('\n--- admin edits sizes while a sale happens ---');
// The admin opened the form when UK 7 had 3. A customer then buys 2.
await call('ben', 'DELETE', `/api/cart/${shoe._id}?variant=${encodeURIComponent('UK 8')}`);
await call('ben', 'POST', '/api/cart', { productId: shoe._id, quantity: 2, variant: 'UK 7' });
r = await call('ben', 'POST', '/api/orders', { shippingAddress: ADDRESS });
expect('customer bought 2 x UK 7', r.status, 201);
r = await call('sa', 'PUT', `/api/products/${shoe._id}`, {
  description: 'Now with a grippier sole',
  variants: [
    { label: 'UK 7', stock: 13, stockWas: 3 }, // admin added 10 pairs
    { label: 'UK 8', stock: 1, stockWas: 1 },
    { label: 'UK 9', stock: 0, stockWas: 0 },
    { label: 'UK 10', stock: 5 }, // a new size
  ],
});
expect('edit saved', r.status, 200, `"${r.body.message}"`);
fresh = await Product.findById(shoe._id);
expect('UK 7 = 1 left + 10 added (the 2 sold are not undone)', fresh.variants.find((v) => v.label === 'UK 7').stock, 11);
expect('new size UK 10 added', fresh.variants.find((v) => v.label === 'UK 10')?.stock, 5);
expect('total recomputed', fresh.stock, 11 + 1 + 0 + 5);

console.log('\n--- a size removed while it sits in a bag ---');
await call('ann', 'POST', '/api/cart', { productId: shoe._id, quantity: 1, variant: 'UK 10' });
await call('sa', 'PUT', `/api/products/${shoe._id}`, {
  variants: fresh.variants.filter((v) => v.label !== 'UK 10').map((v) => ({ label: v.label, stock: v.stock, stockWas: v.stock })),
});
r = await call('ann', 'GET', '/api/cart');
const orphan = r.body.cart?.items?.find((i) => i.variant === 'UK 10');
expect('the bag line is kept but flagged', Boolean(orphan?.problem), true, `"${orphan?.problem}"`);
r = await call('ann', 'POST', '/api/orders', { shippingAddress: ADDRESS });
expect('checkout asks to update the bag', r.status, 409, `"${r.body.message}"`);

console.log('\n--- products without sizes are unchanged ---');
const plain = await Product.findOne({ 'variants.0': { $exists: false }, stock: { $gt: 3 } });
r = await call('ben', 'POST', '/api/cart', { productId: plain._id, quantity: 1, variant: 'XL' });
expect('a stray size on a plain product is ignored', r.body.cart?.items?.find((i) => i.product._id === String(plain._id))?.variant, '');
r = await call('ann', 'POST', `/api/wishlist/${shoe._id}`);
r = await call('ann', 'POST', `/api/wishlist/${shoe._id}/move-to-cart`);
expect('move-to-bag asks for a size first', r.body.code, 'CHOOSE_VARIANT');

await finish();
