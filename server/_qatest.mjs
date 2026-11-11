import { startHarness, ADDRESS } from './_harness.mjs';
import Product from './src/models/Product.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();
for (const u of ['asker', 'buyer', 'other', 'r1', 'r2', 'r3']) await register(u);

const p = await Product.findOne({ stock: { $gt: 5 } });
const base = `/api/products/${p.slug}/questions`;

// buyer has a delivered order for this product
await call('buyer', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
let r = await call('buyer', 'POST', '/api/orders', { shippingAddress: ADDRESS });
for (const s of ['confirmed', 'shipped', 'delivered']) {
  await call('sa', 'PATCH', `/api/orders/${r.body.order._id}/status`, { status: s });
}

console.log('--- asking ---');
r = await call(null, 'POST', base, { text: 'Does this come with a charger?' });
expect('guests cannot ask', r.status, 401);
r = await call('asker', 'POST', base, { text: 'Hi' });
expect('too-short question rejected', r.status, 400);
r = await call('asker', 'POST', base, { text: 'Does this come with a charger in the box?' });
expect('question posted', r.status, 201);
const qid = r.body.question._id;
await call('other', 'POST', base, { text: 'What is the warranty period?' });

r = await call(null, 'GET', base);
expect('guests can read questions', r.body.count, 2);

console.log('\n--- answering ---');
r = await call('buyer', 'POST', `/api/questions/${qid}/answers`, { text: 'Yes, a 20W charger is included.', isStaff: true });
expect('buyer answers', r.status, 201);
let ans = r.body.question.answers[0];
expect('verified buyer badge', ans.isVerifiedBuyer, true);
expect('isStaff cannot be self-assigned', ans.isStaff, false);

r = await call('sa', 'POST', `/api/questions/${qid}/answers`, { text: 'Confirmed - charger and cable included.' });
const staffAns = r.body.question.answers.find((a) => a.isStaff);
expect('staff answer badged', Boolean(staffAns), true);

// One person may not fill every answer slot.
await call('other', 'POST', `/api/questions/${qid}/answers`, { text: 'Answer one from other.' });
await call('other', 'POST', `/api/questions/${qid}/answers`, { text: 'Answer two from other.' });
await call('other', 'POST', `/api/questions/${qid}/answers`, { text: 'Answer three from other.' });
r = await call('other', 'POST', `/api/questions/${qid}/answers`, { text: 'Answer four from other.' });
expect('a fourth answer from the same person is refused', r.status, 409);

console.log('\n--- voting ---');
r = await call('asker', 'POST', `/api/questions/${qid}/upvote`);
expect('cannot upvote own question', r.status, 400);
r = await call('other', 'POST', `/api/questions/${qid}/upvote`);
expect('upvote counted', r.body.upvoteCount, 1);
r = await call('other', 'POST', `/api/questions/${qid}/upvote`);
expect('second click removes upvote', r.body.upvoteCount, 0);
await call('other', 'POST', `/api/questions/${qid}/upvote`);

r = await call('buyer', 'POST', `/api/questions/${qid}/answers/${ans._id}/helpful`);
expect('cannot vote own answer helpful', r.status, 400);
r = await call('asker', 'POST', `/api/questions/${qid}/answers/${ans._id}/helpful`);
expect('helpful vote counted', r.body.helpfulCount, 1);

r = await call('asker', 'GET', base);
expect('upvoted question sorted first', r.body.questions[0]._id, qid);
expect('most helpful answer first', r.body.questions[0].answers[0]._id, ans._id);
expect('isMine flagged', r.body.questions[0].isMine, true);
expect('voter ids not leaked', JSON.stringify(r.body).includes('upvotes"'), false);

console.log('\n--- moderation ---');
r = await call('r1', 'POST', `/api/questions/${qid}/report`, { reason: 'spam' });
expect('report accepted', r.status, 200);
r = await call('r1', 'POST', `/api/questions/${qid}/report`, { reason: 'spam' });
expect('duplicate report rejected', r.status, 409);
r = await call('r1', 'GET', '/api/questions/reported');
expect('customers cannot see the queue', r.status, 403);
await call('r2', 'POST', `/api/questions/${qid}/report`, {});
await call('r3', 'POST', `/api/questions/${qid}/report`, {});
r = await call(null, 'GET', base);
expect('auto-hidden after 3 reports', r.body.count, 1);
r = await call('sa', 'GET', '/api/questions/reported');
expect('appears in moderation queue', r.body.questions?.some((q) => q._id === qid), true);
r = await call('sa', 'PATCH', `/api/questions/${qid}/visibility`, { isHidden: false });
expect('admin restores it', r.status, 200);
r = await call(null, 'GET', base);
expect('visible again', r.body.count, 2);

console.log('\n--- deleting ---');
r = await call('other', 'DELETE', `/api/questions/${qid}/answers/${ans._id}`);
expect('cannot delete someone else\'s answer', r.status, 403);
r = await call('buyer', 'DELETE', `/api/questions/${qid}/answers/${ans._id}`);
expect('author deletes own answer', r.status, 200);
r = await call('other', 'DELETE', `/api/questions/${qid}`);
expect('cannot delete someone else\'s question', r.status, 403);
r = await call('sa', 'DELETE', `/api/questions/${qid}`);
expect('staff can delete any question', r.status, 200);

await finish();
