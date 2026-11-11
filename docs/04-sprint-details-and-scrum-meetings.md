# 4. Sprint Details and Scrum Meetings

Cartify was delivered in **4 sprints**. Each sprint ended with working code pushed to GitHub. The dates
below are the delivery dates recorded in the Git history.

## Sprint overview

| Sprint | Period | Sprint goal | Result |
|---|---|---|---|
| 1 | up to 3 Sep 2026 | A working core store | Delivered (initial commit) |
| 2 | 4 Sep – 8 Oct 2026 | Payments, emails and admin tools | Delivered (pull request #1, merged) |
| 3 | 9 Oct – 11 Nov 2026 | Fix bugs, add missing store features, deploy | Delivered |
| 4 | 11 Nov 2026 | Changes from the sprint review | Delivered and live |

## Sprint backlogs

### Sprint 1: Core store

| # | User story | Module |
|---|---|---|
| 1 | As a customer, I can register, log in and log out | Authentication |
| 2 | As a customer, I can browse, search and filter products | Product, Search |
| 3 | As a customer, I can add items to my bag and place an order | Cart, Checkout, Orders |
| 4 | As a customer, I can rate and review a product | Reviews |
| 5 | As a customer, I can ask the AI assistant and compare two products | AI |
| 6 | As an admin, I can manage products, categories, orders and users | Admin dashboard |

### Sprint 2: Payments, emails and admin tools

| # | User story | Module |
|---|---|---|
| 1 | As a customer, I can save products to a wishlist and use coupons | Wishlist, Checkout |
| 2 | As a customer, I can pay online with Razorpay, print an invoice and return an order | Payment, Orders |
| 3 | As a customer, I get emails for my orders and can reset my password | Notifications |
| 4 | As a customer, I can ask and answer questions about a product | Community |
| 5 | As a customer, I can search by voice | Search |
| 6 | As an admin, I can manage customers, settings, coupons and download CSV reports | Admin |
| 7 | As a Super Admin, I can see an activity log of important actions | Security |
| 8 | As a customer, I see recommendations (trending, bought together, for you) | Recommendations |

### Sprint 3: Fix bugs, add missing features, deploy

| # | Backlog item | Type |
|---|---|---|
| 1 | Two shoppers could buy the last item at the same time: make stock updates atomic | Bug |
| 2 | Logout did not work on the deployed site: fix the cookie settings | Bug |
| 3 | Fix order, payment, catalogue and admin bugs found in code review | Bug |
| 4 | Add regression tests for every fixed bug | Testing |
| 5 | Email a sign-in alert and full order details | Story |
| 6 | Make AI search and compare work without an AI key | Story |
| 7 | Add policy pages, contact form and saved addresses | Story |
| 8 | Add sizes/colours, courier tracking and low-stock alerts | Story |
| 9 | Fix the blank homepage caused by an API address mismatch | Bug |

### Sprint 4: Changes from the sprint review

| # | Feedback from the review | What was done |
|---|---|---|
| 1 | Sign-up does not check whether the email really exists | Domain and mailbox checks plus a 6-digit email code |
| 2 | Remove the old confirm-by-link email | Link flow removed; the code is the only check |
| 3 | An online order was placed before the payment finished | The order is created only after payment is verified |
| 4 | Admin needs an "Others" category | Built-in "Others" category added |
| 5 | Deployed site showed "Network Error" and "Route not found" | CORS settings made forgiving; friendly message at the API root |
| 6 | Team needs deployment steps | Beginner's deployment guide written |

## Scrum meetings

The table shows the meeting format the team followed. Meeting dates and minutes are not stored in the
repository, so record them in the daily scrum log below.

| Meeting | When | Length | What happens |
|---|---|---|---|
| Sprint planning | First day of each sprint | 1 hour | Pick backlog items, split them into tasks, share the work |
| Daily scrum | Every working day | 15 minutes | Each member says: what I did, what I will do, what is blocking me |
| Sprint review | Last day of each sprint | 30 minutes | Demo the working store; collect feedback as new backlog items |
| Retrospective | After the review | 30 minutes | What went well, what to improve next sprint |

### Sprint reviews and retrospectives

Summary based on what each sprint delivered and what the next sprint changed.

| Sprint | Review outcome | Retrospective: lesson for next sprint |
|---|---|---|
| 1 | Core store works end to end | Add online payments and emails before more pages |
| 2 | All features merged through pull request #1 | Write test scripts for each module as it is built |
| 3 | Bugs found in review were fixed, each with a regression test | Test on the deployed site, not only on a laptop |
| 4 | Six feedback items done; live site working | Check payment and sign-up flows from the customer's view |

### Daily scrum log (fill in with your real meetings)

| Date | Member | Done yesterday | Plan for today | Blockers |
|---|---|---|---|---|
| | M. Dheeraj | | | |
| | S. Pavan Teja | | | |
| | V. Chakradhar | | | |
