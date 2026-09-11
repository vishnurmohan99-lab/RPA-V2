-- The five house rules and two demo sign-ins, matching web/src/domain/houseRules.ts's
-- RULE_DEFS and web/src/domain/seed.ts's SIGN_INS. Automations/run history are NOT seeded
-- here -- the client seeds those itself on first boot when GET /api/state comes back null
-- for them (see web/src/state/persistence.ts), same as it does against the local JSON store.
insert into house_rules (id, text, "on", sort_order) values
  ('payer-99999', 'Skip anything from payer 99999.', true, 0),
  ('under-5', 'Never send a statement for less than $5.', true, 1),
  ('over-5000', 'Anything over $5,000 waits for me to look at it.', true, 2),
  ('payment-plan', 'Leave patients on an active payment plan alone.', true, 3),
  ('unbalanced', 'Do not touch a batch that has not balanced.', true, 4)
on conflict (id) do nothing;

insert into sign_ins (id, label, "user") values
  ('cred-billing-ro', 'Billing read-only', 'diane.k'),
  ('cred-posting', 'Posting clerk', 'posting.frontdesk')
on conflict (id) do nothing;
