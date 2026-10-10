ALTER TABLE closet_categories DROP CONSTRAINT closet_categories_slot_check;
ALTER TABLE closet_categories ADD CONSTRAINT closet_categories_slot_check
  CHECK (slot IN ('top', 'bottom', 'layer', 'shoes', 'hat', 'extra'));

ALTER TABLE outfit_slots DROP CONSTRAINT outfit_slots_slot_check;
ALTER TABLE outfit_slots ADD CONSTRAINT outfit_slots_slot_check
  CHECK (slot IN ('top', 'bottom', 'layer', 'shoes', 'hat'));

UPDATE closet_categories SET position = 8 WHERE name = 'Accessories' AND slot = 'extra';

INSERT INTO closet_categories (name, slot, position)
VALUES ('Caps / Hats', 'hat', 7)
ON CONFLICT (name) DO NOTHING;
